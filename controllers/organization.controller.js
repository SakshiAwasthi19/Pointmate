const Organization = require('../models/Organization.model');
const User = require('../models/User.model');
const Event = require('../models/Event.model');
const Student = require('../models/Student.model'); // Though not strictly used in logic, imported as per prompt
const Notification = require('../models/Notification.model');
const { uploadToCloudinary, deleteFromCloudinary } = require('../utils/cloudinary.config');
const { validateActivity } = require('../utils/activityValidator');
const fs = require('fs');

// 1. Get Profile
exports.getProfile = async (req, res) => {
    try {
        const organization = await Organization.findOne({ userId: req.user.userId }).populate('userId', 'email userType isVerified');
        if (!organization) {
            return res.status(404).json({ success: false, message: 'Organization profile not found' });
        }

        // Add event count manually if not using virtuals or aggregations yet
        const eventsCount = await Event.countDocuments({ organizationId: organization._id });

        // Spread to object to include counts
        const orgData = organization.toObject();
        orgData.eventsHostedCount = eventsCount;
        // Rating is already in schema

        res.status(200).json({ success: true, data: orgData });
    } catch (error) {
        console.error('Get Org Profile Error:', error.message);
        res.status(500).json({ success: false, message: 'Server Error' });
    }
};

// 2. Update Profile
exports.updateProfile = async (req, res) => {
    try {
        const { institutionName, fullName, designation, authorizedPersonName, contactNumber, organizationType, description, website, location, socialMedia, aicteApprovalNumber } = req.body;

        const organization = await Organization.findOne({ userId: req.user.userId });
        if (!organization) return res.status(404).json({ success: false, message: 'Organization not found' });

        // Check unique AICTE Approval Number
        if (aicteApprovalNumber && aicteApprovalNumber !== organization.aicteApprovalNumber) {
            const exists = await Organization.findOne({ aicteApprovalNumber });
            if (exists) {
                return res.status(400).json({ success: false, message: 'AICTE Approval Number already in use' });
            }
            organization.aicteApprovalNumber = aicteApprovalNumber;
        }

        // Update allowed fields
        if (institutionName) organization.institutionName = institutionName;
        if (fullName) organization.fullName = fullName;
        if (designation) organization.designation = designation;
        if (authorizedPersonName) organization.authorizedPersonName = authorizedPersonName;
        if (contactNumber) organization.contactNumber = contactNumber;
        if (organizationType) organization.organizationType = organizationType;
        if (description) organization.description = description;
        if (website) organization.website = website;

        if (socialMedia) organization.socialMedia = { ...organization.socialMedia, ...socialMedia };

        if (location && location.coordinates) {
            organization.location = {
                type: 'Point',
                coordinates: location.coordinates, // [long, lat]
                address: location.address || organization.location.address,
                city: location.city || organization.location.city,
                state: location.state || organization.location.state,
                pincode: location.pincode || organization.location.pincode
            };
        }

        await organization.save();
        res.status(200).json({ success: true, data: organization, message: 'Profile updated successfully' });

    } catch (error) {
        console.error('Update Org Profile Error:', error.message);
        res.status(500).json({ success: false, message: 'Server Error' });
    }
};

// 3. Upload Logo
exports.uploadLogo = async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ success: false, message: 'Please upload an image' });

        const organization = await Organization.findOne({ userId: req.user.userId });
        if (!organization) return res.status(404).json({ success: false, message: 'Organization not found' });

        // Delete old logo
        if (organization.organizationLogo && organization.organizationLogo.publicId) {
            await deleteFromCloudinary(organization.organizationLogo.publicId);
        }

        // Using CloudinaryStorage (via middleware), file is already uploaded.
        // Normalize Path for Local Storage
        let logoUrl = req.file.path;
        if (req.file.path.includes('uploads')) {
            const filename = req.file.filename;
            logoUrl = `${process.env.API_URL || 'http://localhost:5000'}/uploads/${filename}`;
        }

        const result = {
            url: logoUrl,
            publicId: req.file.filename
        };

        organization.organizationLogo = result;
        await organization.save();

        res.status(200).json({ success: true, data: result.url, message: 'Organization logo updated' });

    } catch (error) {
        console.error('Upload Logo Error:', error.message);
        res.status(500).json({ success: false, message: 'Server Error' });
    }
};

// 4. Create Event with AI Validation
exports.createEvent = async (req, res) => {
    try {
        let { title, description, domain, aictePoints, startDateTime, endDateTime, registrationDeadline, location, mode, onlineLink, maxParticipants, tags, prerequisites, schedule, speakers } = req.body;

        // DEBUGGING LOGS
        console.log('--- Create Event Request Debug ---');
        console.log('Body Keys:', Object.keys(req.body));
        console.log('Location Raw:', req.body.location);
        console.log('File:', req.file ? 'Present' : 'Missing');

        // Parse JSON fields if they are strings (Multipart/form-data)
        try {
            if (typeof location === 'string') location = JSON.parse(location);
            if (typeof tags === 'string') tags = JSON.parse(tags);
            if (typeof prerequisites === 'string') prerequisites = JSON.parse(prerequisites);
            if (typeof schedule === 'string') schedule = JSON.parse(schedule);
            if (typeof speakers === 'string') speakers = JSON.parse(speakers);
        } catch (e) {
            console.error('JSON Parse Error:', e.message);
            return res.status(400).json({ success: false, message: 'Invalid JSON format for array/object fields: ' + e.message });
        }

        console.log('Parsed Location:', location);

        // Detailed Validation
        const missingFields = [];
        if (!title) missingFields.push('title');
        if (!description) missingFields.push('description');
        if (!domain) missingFields.push('domain');
        if (!aictePoints) missingFields.push('aictePoints');
        if (!startDateTime) missingFields.push('startDateTime');
        if (!endDateTime) missingFields.push('endDateTime');
        if (!registrationDeadline) missingFields.push('registrationDeadline');
        if (!location || !location.venue) missingFields.push('location/venue');

        if (missingFields.length > 0) {
            console.warn('Missing Fields:', missingFields);
            if (req.file) await deleteFromCloudinary(req.file.filename);
            return res.status(400).json({
                success: false,
                message: `Missing required fields: ${missingFields.join(', ')}`
            });
        }

        const organization = await Organization.findOne({ userId: req.user.userId });
        if (!organization) {
            if (req.file) await deleteFromCloudinary(req.file.filename);
            return res.status(404).json({ success: false, message: 'Organization profile not found' });
        }

        const schoolId = typeof organization.school_id === 'string'
            ? organization.school_id.trim()
            : organization.school_id;
        if (!schoolId) {
            if (req.file) await deleteFromCloudinary(req.file.filename);
            return res.status(400).json({
                success: false,
                message: 'Organization has no school_id. Update the organization profile before creating events.',
            });
        }

        // DEV MODE: Verification check disabled for testing
        // if (organization.verificationStatus !== 'verified') {
        //     if (req.file) await deleteFromCloudinary(req.file.filename);
        //     return res.status(403).json({ success: false, message: 'Your organization must be verified to create events. Please wait for admin approval.' });
        // }

        // AI Validation
        const aiValidation = await validateActivity(title, description, domain, aictePoints);

        if (aiValidation.passed === false || aiValidation.confidence < 80) {
            if (req.file) await deleteFromCloudinary(req.file.filename);
            return res.status(400).json({
                success: false,
                message: 'Event does not meet AICTE guidelines',
                aiValidation: {
                    confidence: aiValidation.confidence,
                    matchedCategory: aiValidation.matchedCategory,
                    reasoning: aiValidation.reasoning
                }
            });
        }

        // Poster Upload Check
        if (!req.file) {
            return res.status(400).json({ success: false, message: 'Event poster is required' });
        }

        // Parse coordinates
        let parsedCoordinates = [0, 0];
        if (location.coordinates) {
            if (Array.isArray(location.coordinates)) parsedCoordinates = location.coordinates;
            else if (typeof location.coordinates === 'string') parsedCoordinates = JSON.parse(location.coordinates);
        }

        // Helper to normalize path
        let posterUrl = req.file.path;
        if (req.file.path.includes('uploads')) {
            // It's a local path, convert to relative URL
            // Assuming uploads folder is served at /uploads
            const filename = req.file.filename;
            posterUrl = `${process.env.CLIENT_URL || 'http://localhost:5173'}/uploads/${filename}`;
            // Actually, usually we serve from API server, so it might be http://localhost:5000/uploads/filename
            // But let's check where it's served. It's served from API.
            // Let's us relative path if frontend proxy handles it, or full URL.
            // Safer to use relative path if frontend and backend are same domain or just path string.
            // MERN stack usually: Backend at 5000, Frontend at 5173.
            // Frontend needs http://localhost:5000/uploads/filename.
            posterUrl = `${process.env.API_URL || 'http://localhost:5000'}/uploads/${filename}`;
        }

        const event = new Event({
            organizationId: organization._id,
            school_id: schoolId,
            title,
            description,
            domain,
            aictePoints,
            poster: {
                url: posterUrl,
                publicId: req.file.filename
            },
            organizedBy: organization.institutionName,
            location: {
                type: 'Point',
                coordinates: parsedCoordinates,
                venue: location.venue,
                address: location.address || '',
                city: location.city || '',
                state: location.state || ''
            },
            startDateTime,
            endDateTime,
            registrationDeadline,
            mode: mode || 'offline',
            onlineLink: onlineLink || '',
            maxParticipants: maxParticipants || null,
            tags: tags || [],
            prerequisites: prerequisites || [],
            schedule: schedule || [],
            speakers: speakers || [],
            aiValidation: {
                passed: aiValidation.passed,
                confidence: aiValidation.confidence,
                matchedCategory: aiValidation.matchedCategory,
                validatedAt: aiValidation.validatedAt,
                remarks: aiValidation.reasoning
            },
            status: aiValidation.confidence >= 80 ? 'approved' : 'pending' // As per prompt fallback logic
        });

        await event.save();

        organization.eventsHosted.push(event._id);
        await organization.save();

        res.status(201).json({
            success: true,
            message: aiValidation.confidence >= 80
                ? 'Event created and auto-approved (AI confidence >= 80%)'
                : 'Event created and pending admin review (AI confidence < 80%)',
            data: {
                event,
                aiValidation: {
                    confidence: aiValidation.confidence,
                    matchedCategory: aiValidation.matchedCategory,
                    reasoning: aiValidation.reasoning
                }
            }
        });

    } catch (error) {
        // if (req.file) await deleteFromCloudinary(req.file.filename); // Cleanup disabled for dev stability
        console.error('Create Event Error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal Server Error: ' + error.message,
            error: process.env.NODE_ENV === 'development' ? error : undefined
        });
    }
};

// 5. Get My Events
exports.getMyEvents = async (req, res) => {
    try {
        const { status, page = 1, limit = 10 } = req.query;

        const organization = await Organization.findOne({ userId: req.user.userId });
        if (!organization) return res.status(404).json({ success: false, message: 'Organization not found' });

        let filter = { organizationId: organization._id };
        if (status) filter.status = status;

        const skip = (page - 1) * limit;
        const total = await Event.countDocuments(filter);

        const events = await Event.find(filter)
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(parseInt(limit));

        // Convert to JSON to verify virtuals are included (schema options set virtuals: true)

        res.status(200).json({
            success: true,
            data: {
                events,
                pagination: {
                    currentPage: parseInt(page),
                    totalPages: Math.ceil(total / limit),
                    totalEvents: total
                }
            }
        });

    } catch (error) {
        console.error('Get My Events Error:', error.message);
        res.status(500).json({ success: false, message: 'Server Error' });
    }
};

// 6. Get Event Registrations
exports.getEventRegistrations = async (req, res) => {
    try {
        const { eventId } = req.params;

        const organization = await Organization.findOne({ userId: req.user.userId });
        if (!organization) return res.status(404).json({ success: false, message: 'Organization not found' });

        const event = await Event.findById(eventId).populate({
            path: 'registeredStudents.studentId',
            select: 'firstName lastName email studentId collegeName phoneNumber'
        });

        if (!event) return res.status(404).json({ success: false, message: 'Event not found' });

        // Check permission
        if (event.organizationId.toString() !== organization._id.toString()) {
            return res.status(403).json({ success: false, message: "You don't have permission to view this event's registrations" });
        }

        const registrations = event.registeredStudents.map(reg => ({
            student: reg.studentId,
            registeredAt: reg.registeredAt,
            passId: reg.passId,
            attended: reg.attended,
            status: reg.status || 'pending', // Default to pending if legacy data
            feedback: reg.feedback
        }));

        // Sort newest first
        registrations.sort((a, b) => new Date(b.registeredAt) - new Date(a.registeredAt));

        res.status(200).json({
            success: true,
            data: {
                eventTitle: event.title,
                totalRegistrations: registrations.length,
                maxParticipants: event.maxParticipants || 'Unlimited',
                registrations
            }
        });

    } catch (error) {
        console.error('Get Registrations Error:', error.message);
        res.status(500).json({ success: false, message: 'Server Error' });
    }
};

// 7. Get Dashboard
exports.getDashboard = async (req, res) => {
    try {
        const organization = await Organization.findOne({ userId: req.user.userId }).populate('eventsHosted');
        if (!organization) return res.status(404).json({ success: false, message: 'Organization not found' });

        const events = organization.eventsHosted || [];

        const stats = {
            totalEvents: events.length,
            approvedEvents: events.filter(e => e.status === 'approved').length,
            pendingEvents: events.filter(e => e.status === 'pending').length,
            rejectedEvents: events.filter(e => e.status === 'rejected').length,
            completedEvents: events.filter(e => e.status === 'completed').length,
            totalRegistrations: events.reduce((acc, curr) => acc + (curr.registeredStudents ? curr.registeredStudents.length : 0), 0),
            averageEventRating: 0
        };

        // Avg Rating
        const eventsWithRatings = events.filter(e => e.rating && e.rating.count > 0);
        if (eventsWithRatings.length > 0) {
            const sumRatings = eventsWithRatings.reduce((acc, curr) => acc + curr.rating.average, 0);
            stats.averageEventRating = (sumRatings / eventsWithRatings.length).toFixed(1);
        }

        const upcomingEvents = events
            .filter(e => new Date(e.startDateTime) > new Date() && e.status === 'approved')
            .sort((a, b) => new Date(a.startDateTime) - new Date(b.startDateTime))
            .slice(0, 5);

        // Recent events created
        // Need to sort by creation date, but eventsHosted is just array of docs if populated? 
        // Yes, events are populated.
        const recentEvents = [...events]
            .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
            .slice(0, 5);

        res.status(200).json({
            success: true,
            data: {
                organization: {
                    name: organization.institutionName,
                    verificationStatus: organization.verificationStatus,
                    rating: organization.rating
                },
                stats,
                upcomingEvents,
                recentEvents
            }
        });

    } catch (error) {
        console.error('Org Dashboard Error:', error.message);
        res.status(500).json({ success: false, message: 'Server Error' });
    }
};
// 8. Delete Event
exports.deleteEvent = async (req, res) => {
    try {
        const { eventId } = req.params;

        // 1. Find Organization
        const organization = await Organization.findOne({ userId: req.user.userId });
        if (!organization) return res.status(404).json({ success: false, message: 'Organization not found' });

        // 2. Find Event
        const event = await Event.findById(eventId);
        if (!event) return res.status(404).json({ success: false, message: 'Event not found' });

        // 3. Check Ownership
        if (event.organizationId.toString() !== organization._id.toString()) {
            return res.status(403).json({ success: false, message: 'Not authorized to delete this event' });
        }

        // 4. Delete Poster from Cloudinary (if exists and is not a local file URL)
        // Check if it has a publicId and does NOT look like a local url
        if (event.poster && event.poster.publicId && !event.poster.url.includes('/uploads/')) {
            await deleteFromCloudinary(event.poster.publicId);
        } else if (event.poster && event.poster.url.includes('/uploads/')) {
            // Optional: Delete local file. 
            // For now, we'll skip complex local fs cleanup to avoid path issues, 
            // but in production you'd want to fs.unlinkSync the file.
            try {
                // simple cleanup attempt
                const filename = event.poster.publicId; // we stored filename in publicId for local uploads
                if (filename) {
                    const path = require('path');
                    const fs = require('fs');
                    const filePath = path.join(__dirname, '../uploads', filename);
                    if (fs.existsSync(filePath)) {
                        fs.unlinkSync(filePath);
                    }
                }
            } catch (err) {
                console.warn("Failed to delete local file:", err.message);
            }
        }

        // 5. Delete Event Document
        await Event.findByIdAndDelete(eventId);

        // 6. Remove from Organization's eventsHosted array
        organization.eventsHosted = organization.eventsHosted.filter(id => id.toString() !== eventId);
        await organization.save();

        res.status(200).json({ success: true, message: 'Event deleted successfully' });

    } catch (error) {
        console.error('Delete Event Error:', error);
        res.status(500).json({ success: false, message: 'Server Error' });
    }
};

// 9. Update Registration Status
// 9. Update Registration Status
exports.updateRegistrationStatus = async (req, res) => {
    try {
        const { eventId, studentId } = req.params;
        const { status } = req.body;

        if (!['approved', 'rejected'].includes(status)) {
            return res.status(400).json({ success: false, message: 'Invalid status. Must be approved or rejected.' });
        }

        // 1. Find Organization
        const organization = await Organization.findOne({ userId: req.user.userId });
        if (!organization) return res.status(404).json({ success: false, message: 'Organization not found' });

        // 2. Find Event
        const event = await Event.findById(eventId);
        if (!event) return res.status(404).json({ success: false, message: 'Event not found' });

        // 3. Check Permission
        if (event.organizationId.toString() !== organization._id.toString()) {
            return res.status(403).json({ success: false, message: 'Not authorized' });
        }

        // 4. Find Registration
        const registration = event.registeredStudents.find(r => r.studentId.toString() === studentId);
        if (!registration) {
            return res.status(404).json({ success: false, message: 'Registration not found' });
        }

        // 5. Update Status
        registration.status = status;

        // Sync with student's activity log if rejected (remove potential points?)
        // Currently only "Attended" grants points, so Status change here is just for Permission.

        await event.save();
        res.status(200).json({ success: true, message: `Registration ${status}` });

    } catch (error) {
        console.error('Update Registration Status Error:', error.message);
        res.status(500).json({ success: false, message: 'Server Error' });
    }
};

// 10. Mark Attendance
exports.markAttendance = async (req, res) => {
    try {
        const { eventId, studentId } = req.params;
        const { attended } = req.body; // boolean

        const organization = await Organization.findOne({ userId: req.user.userId });
        if (!organization) return res.status(404).json({ success: false, message: 'Organization not found' });

        const event = await Event.findById(eventId);
        if (!event) return res.status(404).json({ success: false, message: 'Event not found' });

        if (event.organizationId.toString() !== organization._id.toString()) {
            return res.status(403).json({ success: false, message: 'Not authorized' });
        }

        const registration = event.registeredStudents.find(r => r.studentId.toString() === studentId);
        if (!registration) {
            return res.status(404).json({ success: false, message: 'Registration not found' });
        }

        // Update Attendance
        registration.attended = attended;
        await event.save();

        // Sync Points to Student Profile
        const student = await Student.findById(studentId);
        if (student) {
            // Check if activity exists
            let activity = student.activities.find(a => a.eventId && a.eventId.toString() === eventId);

            if (attended) {
                // Grant Points: Create or Update Activity to 'approved'
                if (!activity) {
                    student.activities.push({
                        title: event.title,
                        domain: event.domain,
                        aictePoints: event.aictePoints,
                        date: event.startDateTime,
                        semester: student.semester || 1, // Fallback
                        eventId: event._id,
                        status: 'approved', // Grants points
                        remarks: 'Attended Event (Verified)'
                    });
                } else {
                    activity.status = 'approved';
                    activity.remarks = 'Attended Event (Verified)';
                }
            } else {
                // Revoke Points: Remove Activity or set to rejected/pending
                // If previously marked attended, we should probably set status to 'rejected' or remove it to remove points.
                if (activity) {
                    // Start strict: remove it or set rejected. 
                    // 'rejected' effectively zero points in logic.
                    activity.status = 'rejected';
                    activity.remarks = 'Attendance marked absent';
                }
            }

            // Recalculate
            student.calculateTotalPoints();
            await student.save();
        }

        res.status(200).json({ success: true, message: `Attendance marked as ${attended ? 'Present' : 'Absent'}` });

        // Trigger Notification
        if (student) {
            await Notification.create({
                recipientId: student.userId,
                title: attended ? 'Attendance Marked!' : 'Attendance Update',
                message: attended
                    ? `You have been marked present for "${event.title}". Points have been added to your profile.`
                    : `You were marked absent for "${event.title}".`,
                type: attended ? 'success' : 'info',
                link: '/student/activity-log'
            });
        }

    } catch (error) {
        console.error('Mark Attendance Error:', error.message);
        res.status(500).json({ success: false, message: 'Server Error' });
    }
};

// 11. Review Self-Reported Activity
exports.reviewActivity = async (req, res) => {
    try {
        const { studentId, activityId } = req.params;
        const { status, remarks } = req.body;

        if (!['approved', 'rejected'].includes(status)) {
            return res.status(400).json({ success: false, message: 'Status must be approved or rejected' });
        }

        const student = await Student.findById(studentId);
        if (!student) return res.status(404).json({ success: false, message: 'Student not found' });

        const activity = student.activities.id(activityId);
        if (!activity) return res.status(404).json({ success: false, message: 'Activity not found' });

        // Update status
        activity.status = status;
        if (remarks) activity.remarks = remarks;

        // Recalculate points if approved
        if (status === 'approved') {
            student.calculateTotalPoints();
        }

        await student.save();

        // Send Notification
        await Notification.create({
            recipientId: student.userId,
            title: status === 'approved' ? 'Activity Approved!' : 'Activity Rejected',
            message: status === 'approved'
                ? `Your claim for "${activity.title}" has been approved. +${activity.aictePoints} points added.`
                : `Your claim for "${activity.title}" was not approved. Remarks: ${remarks || 'None'}`,
            type: status === 'approved' ? 'success' : 'warning',
            link: '/student/activity-log'
        });

        res.status(200).json({ success: true, message: `Activity ${status} successfully` });

    } catch (error) {
        console.error('Review Activity Error:', error.message);
        res.status(500).json({ success: false, message: 'Server Error' });
    }
};
