const Student = require('../models/Student.model');
const User = require('../models/User.model');
const Notification = require('../models/Notification.model');
const { uploadToCloudinary, deleteFromCloudinary } = require('../utils/cloudinary.config');
const fs = require('fs');
const path = require('path');

// 1. Get Profile
exports.getProfile = async (req, res) => {
    try {
        const student = await Student.findOne({ userId: req.user.userId }).populate('userId', 'email userType isVerified');
        if (!student) {
            return res.status(404).json({ success: false, message: 'Student profile not found' });
        }
        res.status(200).json({ success: true, data: student });
    } catch (error) {
        console.error('Get Profile Error:', error.message);
        res.status(500).json({ success: false, message: 'Server Error' });
    }
};

// 2. Update Profile
exports.updateProfile = async (req, res) => {
    try {
        const { firstName, lastName, studentId, collegeName, year, branch, semester, graduationYear, phoneNumber, address, location } = req.body;

        const student = await Student.findOne({ userId: req.user.userId });
        if (!student) {
            return res.status(404).json({ success: false, message: 'Student not found' });
        }

        // Check unique Student ID (USN)
        if (studentId && studentId !== student.studentId) {
            const exists = await Student.findOne({ studentId });
            if (exists) {
                return res.status(400).json({ success: false, message: 'Student ID already in use' });
            }
        }

        // Update allowed fields
        if (firstName) student.firstName = firstName;
        if (lastName) student.lastName = lastName;
        if (studentId) student.studentId = studentId;
        if (collegeName) student.collegeName = collegeName;
        if (year) student.year = year;
        if (branch) student.branch = branch;
        if (semester) student.semester = semester;
        if (graduationYear) student.graduationYear = graduationYear;
        if (phoneNumber) student.phoneNumber = phoneNumber;
        if (address) student.address = address;

        if (location && location.coordinates) {
            student.location = {
                type: 'Point',
                coordinates: location.coordinates, // [long, lat]
                address: location.address || student.location.address,
                city: location.city || student.location.city,
                state: location.state || student.location.state,
                pincode: location.pincode || student.location.pincode
            };
        }

        await student.save();
        res.status(200).json({ success: true, data: student, message: 'Profile updated successfully' });

    } catch (error) {
        console.error('Update Profile Error:', error.message);
        res.status(500).json({ success: false, message: 'Server Error' });
    }
};

// 3. Upload Profile Picture
exports.uploadProfilePicture = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ success: false, message: 'Please upload an image' });
        }

        const student = await Student.findOne({ userId: req.user.userId });
        if (!student) return res.status(404).json({ success: false, message: 'Student not found' });

        // Delete old signature
        if (student.profilePicture && student.profilePicture.publicId) {
            await deleteFromCloudinary(student.profilePicture.publicId);
        }

        // Note: Middleware already uploaded to Cloudinary if using CloudinaryStorage directly.
        // However, the instructions say "Upload new image to Cloudinary: uploadToCloudinary(req.file.path, 'profiles')"
        // If we use CloudinaryStorage in middleware, req.file.path IS the cloudinary URL.
        // But if we use uploadToCloudinary utility, we usually use diskStorage in middleware.
        // Given the prompt asked for CloudinaryStorage in middleware, req.file is already uploaded.
        // BUT the prompt ALSO asked to call `uploadToCloudinary` in this controller.
        // This implies a conflict or a requirement to handle file explicitly.
        // I will assume the middleware (CloudinaryStorage) sets req.file with `path` as the remote URL.
        // BUT `uploadToCloudinary` utility uploads from LOCAL path.
        // OPTION: If middleware uses CloudinaryStorage, the upload happens BEFORE controller.
        // I will trust req.file from CloudinaryStorage which usually has `path` as the URL and `filename` as public_id.

        // ADJUSTMENT: The instructions for this controller explicitly say:
        // "Upload new image to Cloudinary: uploadToCloudinary(req.file.path, 'profiles')"
        // "Delete local file: fs.unlinkSync(req.file.path)"
        // This strongly implies the middleware should be DISK STORAGE or similar? 
        // BUT Step 188 said "Use CloudinaryStorage from multer-storage-cloudinary".
        // I will use the CloudinaryStorage results directly since that's what the middleware is built with.
        // It's cleaner. But to strictly follow "uploadToCloudinary" instruction, I'd need local files.
        // Using CloudinaryStorage is the modern and efficient way defined in middleware.
        // I will map the CloudinaryStorage result to the DB model.

        // WAIT: If I follow the prompt literally: "delete local file: fs.unlinkSync" implies local storage was used.
        // But middleware task (Step 188) said "Use CloudinaryStorage".
        // I'll stick to CloudinaryStorage result logic because it's safer/better, but I'll add a check.

        // Initialize result
        let profileUrl = req.file.path;

        // Normalize Path for Local Storage
        if (req.file.path.includes('uploads')) {
            const filename = req.file.filename;
            profileUrl = `${process.env.API_URL || 'http://localhost:5000'}/uploads/${filename}`;
        }

        const result = {
            url: profileUrl,
            publicId: req.file.filename
        };

        student.profilePicture = result;
        await student.save();

        res.status(200).json({ success: true, data: result.url, message: 'Profile picture updated' });

    } catch (error) {
        console.error('Upload PP Error:', error.message);
        res.status(500).json({ success: false, message: 'Server Error' });
    }
};

// 4. Get Points Summary
exports.getPointsSummary = async (req, res) => {
    try {
        const student = await Student.findOne({ userId: req.user.userId });
        if (!student) {
            return res.status(404).json({ success: false, message: 'Student not found' });
        }

        const totalPoints = typeof student.calculateTotalPoints === 'function'
            ? student.calculateTotalPoints()
            : (Number(student.totalPoints) || 0);
        const progress = typeof student.getProgress === 'function'
            ? student.getProgress()
            : {
                current: Number(student.totalPoints) || 0,
                target: 100,
                percentage: 0,
                remaining: 100
            };

        const activities = Array.isArray(student.activities) ? student.activities : [];

        const pointsByCategory = {
            'Technical': 0,
            'Soft Skills': 0,
            'Community Service': 0,
            'Cultural': 0,
            'Sports': 0,
            'Environmental': 0
        };

        activities
            .filter((a) => a && a.status === 'approved')
            .forEach((act) => {
                const domain = act.domain;
                if (domain && pointsByCategory[domain] !== undefined) {
                    pointsByCategory[domain] += Number(act.aictePoints) || 0;
                }
            });

        const recentActivities = activities
            .filter((a) => a && a.status === 'approved')
            .sort((a, b) => new Date(b?.date || 0) - new Date(a?.date || 0))
            .slice(0, 5);

        const semesterWisePoints = Array.isArray(student.semesterWisePoints) && student.semesterWisePoints.length
            ? student.semesterWisePoints
            : Array.from({ length: 8 }, (_, i) => ({ semester: i + 1, points: 0 }));

        res.status(200).json({
            success: true,
            data: {
                totalPoints,
                progress,
                semesterWisePoints,
                pointsByCategory,
                recentActivities
            }
        });
    } catch (error) {
        console.error('Points Summary Error:', error.message);
        res.status(500).json({ success: false, message: 'Server Error' });
    }
};

// 5. Add Activity
exports.addActivity = async (req, res) => {
    try {
        const { title, description, domain, aictePoints, date, semester, eventId } = req.body;

        // Validation
        if (!title || !domain || aictePoints === undefined || !date || !semester) {
            return res.status(400).json({ success: false, message: 'Missing required fields' });
        }

        const validDomains = ['Technical', 'Soft Skills', 'Community Service', 'Cultural', 'Sports', 'Environmental'];
        if (!validDomains.includes(domain)) {
            return res.status(400).json({ success: false, message: 'Invalid domain' });
        }

        if (semester < 1 || semester > 8) {
            return res.status(400).json({ success: false, message: 'Semester must be 1-8' });
        }

        if (aictePoints < 0) {
            return res.status(400).json({ success: false, message: 'Points cannot be negative' });
        }

        const student = await Student.findOne({ userId: req.user.userId });
        if (!student) return res.status(404).json({ success: false, message: 'Student not found' });

        const newActivity = {
            title,
            description: description || '',
            domain,
            aictePoints,
            date,
            semester,
            eventId: eventId || null,
            certificates: [],
            photos: [],
            status: 'pending',
            remarks: '',
            createdAt: new Date()
        };

        student.activities.push(newActivity);
        await student.save();

        res.status(201).json({ success: true, data: student.activities[student.activities.length - 1], message: 'Activity added successfully' });

    } catch (error) {
        console.error('Add Activity Error:', error.message);
        res.status(500).json({ success: false, message: 'Server Error' });
    }
};

// 6. Upload Certificate/Photo
exports.uploadCertificate = async (req, res) => {
    try {
        const { activityId } = req.params;
        const { uploadType } = req.body; // 'certificate' or 'photo'

        if (!req.file) return res.status(400).json({ success: false, message: 'Please upload a file' });

        const student = await Student.findOne({ userId: req.user.userId });
        if (!student) return res.status(404).json({ success: false, message: 'Student not found' });

        // Normalize activityId (remove any prefix like 'a_' if it exists)
        const cleanId = activityId.startsWith('a_') ? activityId.substring(2) : activityId;

        let activity = student.activities.id(cleanId);

        // Fallback: If not found by direct ID, search for an activity linked to this ID as an eventId
        if (!activity) {
            activity = student.activities.find(a =>
                (a.eventId && a.eventId.toString() === cleanId) ||
                (a._id && a._id.toString() === cleanId)
            );
        }

        // Second Fallback: If still not found, check if student is registered for this Event
        if (!activity) {
            const isRegistered = student.registeredEvents.some(id => id.toString() === cleanId);
            if (isRegistered) {
                const Event = require('../models/Event.model');
                const event = await Event.findById(cleanId);
                if (event) {
                    const newActivity = {
                        title: event.title,
                        domain: event.domain,
                        aictePoints: event.aictePoints,
                        date: event.startDateTime,
                        semester: student.semester || 1,
                        eventId: event._id,
                        status: 'pending',
                        remarks: 'Self-reported proof upload'
                    };
                    student.activities.push(newActivity);
                    activity = student.activities[student.activities.length - 1];
                }
            }
        }

        if (!activity) return res.status(404).json({ success: false, message: 'Activity not found for this identifier' });

        // Format response (Handle local vs cloudinary)
        const fileUrl = req.file.path.startsWith('http')
            ? req.file.path
            : `/uploads/${req.file.filename}`;

        const fileData = {
            url: fileUrl,
            publicId: req.file.filename,
            uploadedAt: new Date()
        };

        if (uploadType === 'certificate') {
            activity.certificates.push(fileData);
        } else if (uploadType === 'photo') {
            activity.photos.push(fileData);
        } else {
            // Cleanup if invalid type (though middleware limits formats, logic still applies)
            if (req.file.filename) await deleteFromCloudinary(req.file.filename);
            return res.status(400).json({ success: false, message: 'Invalid upload type' });
        }

        await student.save();
        res.status(200).json({ success: true, data: fileData, message: 'File uploaded successfully' });

    } catch (error) {
        console.error('Upload Cert Error:', error.message);
        res.status(500).json({ success: false, message: 'Server Error' });
    }
};

// 7. Get Activity Log
// 7. Get Activity Log
exports.getActivityLog = async (req, res) => {
    try {
        const { semester, domain, status, page = 1, limit = 10 } = req.query;

        // Populate registeredEvents too
        const student = await Student.findOne({ userId: req.user.userId })
            .populate({
                path: 'activities.eventId',
                select: 'title organizedBy'
            })
            .populate({
                path: 'registeredEvents',
                select: 'title domain aictePoints startDateTime endDateTime status registeredStudents organizedBy'
            });

        if (!student) return res.status(404).json({ success: false, message: 'Student not found' });

        // 1. Process Self-Reported Activities
        let normalizedActivities = student.activities.map(act => ({
            _id: act._id,
            type: 'activity', // Self-reported
            title: act.title,
            domain: act.domain,
            aictePoints: act.aictePoints,
            date: act.date,
            status: act.status, // pending, approved, rejected
            isUpcoming: false, // Self-reported are usually past
            certificates: act.certificates || [],
            activityId: act._id,
            details: act // Keep original if needed
        }));

        // 2. Process Registered Events
        const normalizedEvents = [];
        if (student.registeredEvents && student.registeredEvents.length > 0) {
            student.registeredEvents.forEach(event => {
                // Find my specific registration
                const myReg = event.registeredStudents.find(r => r.studentId.toString() === student._id.toString());

                if (myReg) {
                    const now = new Date();
                    const isUpcoming = new Date(event.endDateTime || event.startDateTime) > now;

                    // Determine display status
                    let displayStatus = myReg.status; // pending, approved, rejected

                    // Priority: Attended > Approved/Upcoming > Pending
                    if (myReg.attended) {
                        displayStatus = 'attended';
                    } else if (displayStatus === 'approved' && !isUpcoming) {
                        // Registration approved but event passed and NOT marked attended
                        // Could be 'absent' or just 'not marked yet'. 
                        // Let's keep it as 'approved' (meaning registered) or 'missed' if we want to be strict.
                        // For now, let's leave it as 'approved' (Registered) but not 'attended'.
                        // Or maybe change text to "Registered (Absent)" on frontend?
                    }

                    // Find matching activity for certificates (ID or Title match)
                    const matchingActivity = student.activities.find(a =>
                        (a.eventId && a.eventId.toString() === event._id.toString()) ||
                        (a.title.toLowerCase().trim() === event.title.toLowerCase().trim())
                    );

                    normalizedEvents.push({
                        _id: event._id, // Event ID
                        type: 'event', // Platform Event
                        title: event.title,
                        domain: event.domain,
                        aictePoints: event.aictePoints,
                        date: event.startDateTime,
                        status: displayStatus,
                        isUpcoming: isUpcoming,
                        certificates: matchingActivity ? matchingActivity.certificates : [],
                        activityId: matchingActivity ? matchingActivity._id : null,
                        details: {
                            organizedBy: event.organizedBy,
                            passId: myReg.passId,
                            venue: event.location ? event.location.venue : 'N/A',
                            attended: myReg.attended
                        }
                    });
                }
            });
        }

        // 3. Deduplicate & Merge
        // If an event is in 'normalizedEvents', don't show the corresponding 'activity' (system generated for points)
        // because normalizedEvents has richer data (Pass ID, etc).
        const eventIds = new Set(normalizedEvents.map(e => e._id.toString()));
        const eventTitles = new Set(normalizedEvents.map(e => e.title.toLowerCase().trim()));

        const uniqueActivities = normalizedActivities.filter(act => {
            // 1. Check by ID (Precise)
            if (act.details.eventId && eventIds.has(act.details.eventId.toString())) {
                return false;
            }

            // 2. Check by Title (Fallback for legacy/manual entries without ID link)
            // If the activity title matches a registered event title, assume it's the same activity
            if (act.title && eventTitles.has(act.title.toLowerCase().trim())) {
                return false;
            }

            return true;
        });

        let combinedLog = [...uniqueActivities, ...normalizedEvents];

        // 4. Filter
        // Note: Filter logic needs to adapt to merged structure
        if (semester) {
            // Activities have semester, Events don't strictly have 'semester' stored on them readily 
            // unless we calculate it from date or student adds it. 
            // For now, filter ONLY self-reported if semester is specified, or ignore for events?
            // Let's filter merged list where property exists
            combinedLog = combinedLog.filter(a => a.details.semester == semester || !a.details.semester);
        }
        if (domain) combinedLog = combinedLog.filter(a => a.domain === domain);
        if (status) combinedLog = combinedLog.filter(a => a.status === status);

        // 5. Sort (Newest First)
        combinedLog.sort((a, b) => new Date(b.date) - new Date(a.date));

        // 6. Pagination
        const pageNum = parseInt(page);
        const limitNum = parseInt(limit);
        const startIndex = (pageNum - 1) * limitNum;
        const endIndex = startIndex + limitNum;
        const paginatedData = combinedLog.slice(startIndex, endIndex);

        res.status(200).json({
            success: true,
            data: {
                activities: paginatedData,
                pagination: {
                    currentPage: pageNum,
                    totalPages: Math.ceil(combinedLog.length / limitNum),
                    totalActivities: combinedLog.length
                }
            }
        });

    } catch (error) {
        console.error('Activity Log Error:', error.message);
        res.status(500).json({ success: false, message: 'Server Error' });
    }
};

// 8. Delete Activity
exports.deleteActivity = async (req, res) => {
    try {
        const { activityId } = req.params;

        const student = await Student.findOne({ userId: req.user.userId });
        if (!student) return res.status(404).json({ success: false, message: 'Student not found' });

        const activity = student.activities.id(activityId);
        if (!activity) return res.status(404).json({ success: false, message: 'Activity not found' });

        // Clean up cloud files
        if (activity.certificates) {
            for (const cert of activity.certificates) {
                await deleteFromCloudinary(cert.publicId);
            }
        }
        if (activity.photos) {
            for (const photo of activity.photos) {
                await deleteFromCloudinary(photo.publicId);
            }
        }

        // Remove
        student.activities.pull(activityId);

        // Recalculate
        student.calculateTotalPoints();

        // Recalculate semester wise
        const approved = student.activities.filter(a => a.status === 'approved');
        student.semesterWisePoints.forEach(sem => sem.points = 0); // Reset
        approved.forEach(act => {
            const semStats = student.semesterWisePoints.find(s => s.semester === act.semester);
            if (semStats) semStats.points += act.aictePoints;
        });

        await student.save();

        res.status(200).json({
            success: true,
            message: 'Activity deleted successfully',
            data: { totalPoints: student.totalPoints }
        });

    } catch (error) {
        console.error('Delete Activity Error:', error.message);
        res.status(500).json({ success: false, message: 'Server Error' });
    }
};

// 9. Get Dashboard
exports.getDashboard = async (req, res) => {
    try {
        const student = await Student.findOne({ userId: req.user.userId })
            .populate('registeredEvents', 'title startDateTime endDateTime organizedBy poster');

        if (!student) {
            return res.status(404).json({ success: false, message: 'Student not found' });
        }

        if (typeof student.calculateTotalPoints === 'function') {
            student.calculateTotalPoints();
        }
        const progress = typeof student.getProgress === 'function'
            ? student.getProgress()
            : {
                current: Number(student.totalPoints) || 0,
                target: 100,
                percentage: 0,
                remaining: 100
            };

        const activities = Array.isArray(student.activities) ? student.activities : [];
        const registeredEvents = Array.isArray(student.registeredEvents)
            ? student.registeredEvents.filter((e) => e != null)
            : [];

        const stats = {
            totalActivities: activities.length,
            pendingActivities: activities.filter((a) => a && a.status === 'pending').length,
            approvedActivities: activities.filter((a) => a && a.status === 'approved').length,
            rejectedActivities: activities.filter((a) => a && a.status === 'rejected').length,
            registeredEvents: registeredEvents.length
        };

        const upcomingEvents = registeredEvents
            .filter((e) => e && new Date(e.endDateTime || e.startDateTime || 0) > new Date())
            .sort((a, b) => new Date(a.startDateTime || 0) - new Date(b.startDateTime || 0))
            .slice(0, 5);

        const recentActivities = [...activities]
            .sort((a, b) => new Date(b?.createdAt || b?.date || 0) - new Date(a?.createdAt || a?.date || 0))
            .slice(0, 5);

        const pointsByCategory = {
            'Technical': 0, 'Soft Skills': 0, 'Community Service': 0,
            'Cultural': 0, 'Sports': 0, 'Environmental': 0
        };
        activities
            .filter((a) => a && a.status === 'approved')
            .forEach((act) => {
                const domain = act.domain;
                if (domain && pointsByCategory[domain] !== undefined) {
                    pointsByCategory[domain] += Number(act.aictePoints) || 0;
                }
            });

        res.status(200).json({
            success: true,
            data: {
                totalPoints: Number(student.totalPoints) || 0,
                progress,
                stats,
                upcomingEvents,
                recentActivities,
                pointsByCategory
            }
        });
    } catch (error) {
        console.error('Dashboard Error:', error.message);
        res.status(500).json({ success: false, message: 'Server Error' });
    }
};
// 10. Get All Certificates
exports.getCertificates = async (req, res) => {
    try {
        const student = await Student.findOne({ userId: req.user.userId });
        if (!student) return res.status(404).json({ success: false, message: 'Student not found' });

        const certificates = [];
        student.activities.forEach(act => {
            if (act.certificates && act.certificates.length > 0) {
                act.certificates.forEach(cert => {
                    certificates.push({
                        _id: cert._id,
                        url: cert.url,
                        activityId: act._id,
                        activityTitle: act.title,
                        domain: act.domain,
                        date: act.date,
                        uploadedAt: cert.uploadedAt
                    });
                });
            }
        });

        // Sort by upload date
        certificates.sort((a, b) => new Date(b.uploadedAt || 0) - new Date(a.uploadedAt || 0));

        res.status(200).json({
            success: true,
            data: certificates
        });

    } catch (error) {
        console.error('Get Certificates Error:', error.message);
        res.status(500).json({ success: false, message: 'Server Error' });
    }
};

// 11. Delete Certificate
exports.deleteCertificate = async (req, res) => {
    try {
        const { activityId, certificateId } = req.params;

        const student = await Student.findOne({ userId: req.user.userId });
        if (!student) return res.status(404).json({ success: false, message: 'Student not found' });

        // Normalize activityId
        const cleanId = activityId.startsWith('a_') ? activityId.substring(2) : activityId;

        let activity = student.activities.id(cleanId);
        if (!activity) {
            activity = student.activities.find(a =>
                (a.eventId && a.eventId.toString() === cleanId) ||
                (a._id && a._id.toString() === cleanId)
            );
        }

        if (!activity) return res.status(404).json({ success: false, message: 'Activity not found' });

        const certificate = activity.certificates.id(certificateId);
        if (!certificate) return res.status(404).json({ success: false, message: 'Certificate not found' });

        // Delete from storage
        const { publicId, url } = certificate;
        if (url.startsWith('http')) {
            // Cloudinary
            await deleteFromCloudinary(publicId);
        } else {
            // Local storage logic (url is /uploads/filename)
            const filename = url.split('/').pop();
            const filePath = path.join(__dirname, '../uploads', filename);
            if (fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
            }
        }

        // Remove from array
        activity.certificates.pull(certificateId);
        await student.save();

        res.status(200).json({ success: true, message: 'Certificate deleted successfully' });

    } catch (error) {
        console.error('Delete Certificate Error:', error.message);
        res.status(500).json({ success: false, message: 'Server Error' });
    }
};

// 12. Get Student Notifications
exports.getNotifications = async (req, res) => {
    try {
        const notifications = await Notification.find({ recipientId: req.user.userId })
            .sort({ createdAt: -1 })
            .limit(20);

        const unreadCount = await Notification.countDocuments({
            recipientId: req.user.userId,
            isRead: false
        });

        res.status(200).json({
            success: true,
            data: {
                notifications,
                unreadCount
            }
        });
    } catch (error) {
        console.error('Get Notifications Error:', error.message);
        res.status(500).json({ success: false, message: 'Server Error' });
    }
};

// 13. Mark Notifications as Read
exports.markNotificationsRead = async (req, res) => {
    try {
        await Notification.updateMany(
            { recipientId: req.user.userId, isRead: false },
            { $set: { isRead: true } }
        );

        res.status(200).json({ success: true, message: 'Notifications marked as read' });
    } catch (error) {
        console.error('Mark Notifications Read Error:', error.message);
        res.status(500).json({ success: false, message: 'Server Error' });
    }
};

// 14. Clear All Notifications
exports.clearNotifications = async (req, res) => {
    try {
        await Notification.deleteMany({ recipientId: req.user.userId });
        res.status(200).json({ success: true, message: 'Notifications cleared successfully' });
    } catch (error) {
        console.error('Clear Notifications Error:', error.message);
        res.status(500).json({ success: false, message: 'Server Error' });
    }
};
