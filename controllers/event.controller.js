const Event = require('../models/Event.model');
const Student = require('../models/Student.model');
const Organization = require('../models/Organization.model');
const QRCode = require('qrcode');
const crypto = require('crypto');

// 1. Get All Events (Public)
exports.getAllEvents = async (req, res) => {
    try {
        const { domain, city, state, mode, search, page = 1, limit = 10, sortBy = 'startDateTime' } = req.query;

        // const filter = { status: 'approved', startDateTime: { $gte: new Date() } };

        // DEV MODE: Show all events (including pending and past) for easier testing
        const filter = {};

        if (domain) filter.domain = domain;
        if (city) filter['location.city'] = { $regex: city, $options: 'i' };
        if (state) filter['location.state'] = { $regex: state, $options: 'i' };
        if (mode) filter.mode = mode;

        if (search) {
            filter.$or = [
                { title: { $regex: search, $options: 'i' } },
                { description: { $regex: search, $options: 'i' } }
            ];
        }

        const skip = (parseInt(page) - 1) * parseInt(limit);

        const total = await Event.countDocuments(filter);

        const events = await Event.find(filter)
            .populate('organizationId', 'institutionName organizationLogo rating')
            .sort({ [sortBy]: 1 }) // Default ascending (closest date first)
            .skip(skip)
            .limit(parseInt(limit));

        res.status(200).json({
            success: true,
            data: {
                events,
                pagination: {
                    currentPage: parseInt(page),
                    totalPages: Math.ceil(total / parseInt(limit)),
                    totalEvents: total,
                    eventsPerPage: parseInt(limit)
                }
            }
        });
    } catch (error) {
        console.error('Get All Events Error:', error.message);
        res.status(500).json({ success: false, message: 'Server Error' });
    }
};

// 2. Get Nearby Events (Student Protected)
exports.getNearbyEvents = async (req, res) => {
    try {
        const { latitude, longitude, radius = 10 } = req.query; // Radius in km

        if (!latitude || !longitude) {
            return res.status(400).json({ success: false, message: 'Latitude and longitude are required' });
        }

        const radiusInMeters = parseFloat(radius) * 1000;

        const events = await Event.find({
            status: 'approved',
            startDateTime: { $gte: new Date() },
            location: {
                $near: {
                    $geometry: {
                        type: 'Point',
                        coordinates: [parseFloat(longitude), parseFloat(latitude)]
                    },
                    $maxDistance: radiusInMeters
                }
            }
        })
            .populate('organizationId', 'institutionName organizationLogo')
            .limit(20);

        // Note: $near implicitly sorts by distance. 
        // To get explicit distance in output, we might need aggregation framework with $geoNear,
        // but `find` with `$near` does not return distance field in document.
        // However, the prompt implies we should just return list sorted by distance.

        res.status(200).json({
            success: true,
            data: {
                events,
                searchRadius: parseFloat(radius),
                totalFound: events.length
            }
        });

    } catch (error) {
        console.error('Get Nearby Events Error:', error.message);
        res.status(500).json({ success: false, message: 'Server Error' });
    }
};

// 3. Get Event By ID (Public)
exports.getEventById = async (req, res) => {
    try {
        const { eventId } = req.params;

        // View tracking
        const event = await Event.findByIdAndUpdate(eventId, { $inc: { views: 1 } }, { new: true })
            .populate('organizationId', 'institutionName organizationLogo rating contactNumber website socialMedia');

        if (!event) {
            return res.status(404).json({ success: false, message: 'Event not found' });
        }

        res.status(200).json({
            success: true,
            data: { event }
        });

    } catch (error) {
        console.error('Get Event Detail Error:', error.message);
        res.status(500).json({ success: false, message: 'Server Error' });
    }
};

// 4. Register For Event (Student Protected)
exports.registerForEvent = async (req, res) => {
    try {
        const userId = req.user.userId;
        const eventId = req.params.eventId || req.body.eventId;

        const student = await Student.findOne({ userId });
        if (!student) return res.status(404).json({ success: false, message: 'Student profile not found' });

        const event = await Event.findById(eventId);
        if (!event) return res.status(404).json({ success: false, message: 'Event not found' });

        // Business Logic Checks
        if (!event.isRegistrationOpen()) {
            return res.status(400).json({ success: false, message: 'Registration is closed for this event' });
        }

        if (event.isFull()) {
            return res.status(400).json({ success: false, message: 'Event is full. No more registrations allowed' });
        }

        if (event.isStudentRegistered(student._id)) {
            return res.status(400).json({ success: false, message: 'You are already registered for this event' });
        }

        if (student.registeredEvents && student.registeredEvents.includes(eventId)) {
            return res.status(400).json({ success: false, message: 'Already registered' });
        }

        // Generate Unique Pass ID
        const generatedPassId = crypto.randomBytes(8).toString('hex');

        // Safety check for Pass ID collision (rare but good practice)
        const regs = Array.isArray(event.registeredStudents) ? event.registeredStudents : [];
        const isPassIdDuplicate = regs.some((r) => r.passId === generatedPassId);
        if (isPassIdDuplicate) {
            // Retry once simple trick
            return exports.registerForEvent(req, res);
        }

        const registration = {
            studentId: student._id,
            registeredAt: new Date(),
            passId: generatedPassId,
            attended: false,
            feedback: null
        };

        event.registeredStudents.push(registration);
        await event.save();

        student.registeredEvents.push(eventId);
        await student.save();

        res.status(200).json({
            success: true,
            message: 'Successfully registered for the event',
            data: {
                passId: generatedPassId,
                eventTitle: event.title,
                eventDate: event.startDateTime,
                venue: event.location.venue
            }
        });

    } catch (error) {
        console.error('Register Event Error:', error.message);
        res.status(500).json({ success: false, message: 'Server Error' });
    }
};

// 5. Get Event Pass (Student Protected)
exports.getEventPass = async (req, res) => {
    try {
        const userId = req.user.userId;
        const { eventId } = req.params;

        const student = await Student.findOne({ userId });
        if (!student) return res.status(404).json({ success: false, message: 'Student profile not found' });

        const event = await Event.findById(eventId).populate('organizationId', 'institutionName');
        if (!event) return res.status(404).json({ success: false, message: 'Event not found' });

        const registration = event.registeredStudents.find(r => r.studentId.toString() === student._id.toString());
        if (!registration) {
            return res.status(403).json({ success: false, message: 'You are not registered for this event' });
        }

        const qrData = {
            passId: registration.passId,
            eventId: event._id,
            eventTitle: event.title,
            studentId: student._id,
            studentName: `${student.firstName} ${student.lastName}`,
            studentUSN: student.studentId,
            registeredAt: registration.registeredAt,
            eventDate: event.startDateTime
        };

        const qrCodeDataURL = await QRCode.toDataURL(JSON.stringify(qrData));

        res.status(200).json({
            success: true,
            data: {
                pass: {
                    passId: registration.passId,
                    qrCode: qrCodeDataURL,
                    studentName: qrData.studentName,
                    studentUSN: qrData.studentUSN,
                    eventTitle: event.title,
                    organizedBy: event.organizedBy,
                    venue: event.location.venue,
                    date: event.startDateTime,
                    registeredAt: registration.registeredAt
                }
            }
        });

    } catch (error) {
        console.error('Get Pass Error:', error.message);
        res.status(500).json({ success: false, message: 'Server Error' });
    }
};
