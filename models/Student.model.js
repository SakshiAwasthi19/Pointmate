const mongoose = require('mongoose');

const ActivityItemSchema = new mongoose.Schema({
    title: { type: String, default: '' },
    description: { type: String, default: '' },
    domain: { type: String, default: '' },
    aictePoints: { type: Number, default: 0 },
    date: { type: Date },
    semester: { type: Number, min: 1, max: 8 },
    eventId: { type: mongoose.Schema.Types.ObjectId, ref: 'Event' },
    certificates: [{
        url: String,
        publicId: String,
        uploadedAt: Date,
    }],
    photos: [{
        url: String,
        publicId: String,
        uploadedAt: Date,
    }],
    status: { type: String, default: 'pending' },
    remarks: { type: String, default: '' },
}, { timestamps: true });

const StudentSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        unique: true,
    },
    firstName: {
        type: String,
        required: [true, 'First name is required'],
        trim: true,
    },
    lastName: {
        type: String,
        required: [true, 'Last name is required'],
        trim: true,
    },
    email: {
        type: String,
        required: true, // Redundant but good for quick access
    },
    studentId: {
        type: String,
        required: [true, 'Student ID (USN) is required'],
        unique: true,
        uppercase: true,
        trim: true,
    },
    collegeName: {
        type: String,
        required: [true, 'College name is required'],
    },
    year: {
        type: String,
    },
    branch: {
        type: String,
    },
    semester: {
        type: Number,
        default: 1,
        min: 1,
        max: 8,
    },
    graduationYear: {
        type: String,
    },
    school_id: {
        type: String,
        required: [true, 'School ID is required'],
        index: true,
    },
    phoneNumber: {
        type: String,
        required: [true, 'Phone number is required'],
    },
    address: {
        type: String,
    },
    profilePicture: {
        url: String,
        publicId: String,
    },
    totalPoints: {
        type: Number,
        default: 0,
    },
    semesterWisePoints: {
        type: [{
            semester: { type: Number, required: true },
            points: { type: Number, default: 0 },
        }],
        default: Array.from({ length: 8 }, (_, i) => ({ semester: i + 1, points: 0 })),
    },
    location: {
        type: {
            type: String,
            enum: ['Point'],
            default: 'Point',
        },
        coordinates: {
            type: [Number], // [longitude, latitude]
            index: '2dsphere',
        },
        address: String,
        city: String,
        state: String,
        pincode: String,
    },
    activities: {
        type: [ActivityItemSchema],
        default: [],
    },
    registeredEvents: {
        type: [{
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Event',
        }],
        default: [],
    },
}, { 
    timestamps: true 
});

// Index for geospacial queries
StudentSchema.index({ location: '2dsphere' });

// Method to calculate total points & semester-wise distribution
StudentSchema.methods.calculateTotalPoints = function () {
    const activities = Array.isArray(this.activities) ? this.activities : [];
    const approvedActivities = activities.filter(a => a && a.status === 'approved');

    // 1. Total Points
    this.totalPoints = approvedActivities.reduce(
        (sum, act) => sum + (Number(act?.aictePoints) || 0),
        0
    );

    // 2. Semester Wise Points — reset then aggregate
    this.semesterWisePoints = Array.from({ length: 8 }, (_, i) => ({ semester: i + 1, points: 0 }));

    approvedActivities.forEach((act) => {
        const sem = Number(act?.semester);
        if (sem >= 1 && sem <= 8) {
            const index = sem - 1;
            if (this.semesterWisePoints[index]) {
                this.semesterWisePoints[index].points += Number(act?.aictePoints) || 0;
            }
        }
    });

    return Number(this.totalPoints) || 0;
};

// Method to get progress
StudentSchema.methods.getProgress = function () {
    const target = 100;
    if (typeof this.calculateTotalPoints === 'function') {
        this.calculateTotalPoints();
    }
    const current = Number(this.totalPoints) || 0;
    return {
        current,
        target,
        percentage: Math.min((current / target) * 100, 100),
        remaining: Math.max(target - current, 0),
    };
};

module.exports = mongoose.model('Student', StudentSchema);
