const mongoose = require('mongoose');

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
}, { 
    timestamps: true 
});

// Index for geospacial queries
StudentSchema.index({ location: '2dsphere' });

// Method to calculate total points & semester-wise distribution
StudentSchema.methods.calculateTotalPoints = function () {
    const approvedActivities = this.activities.filter(a => a.status === 'approved');

    // 1. Total Points
    this.totalPoints = approvedActivities.reduce((sum, act) => sum + act.aictePoints, 0);

    // 2. Semester Wise Points
    // Reset to 0 first
    this.semesterWisePoints = Array.from({ length: 8 }, (_, i) => ({ semester: i + 1, points: 0 }));

    // Aggregation
    approvedActivities.forEach(act => {
        // Ensure semester is valid 1-8
        if (act.semester >= 1 && act.semester <= 8) {
            // Find the bucket (array index is semester - 1)
            const index = act.semester - 1;
            if (this.semesterWisePoints[index]) {
                this.semesterWisePoints[index].points += act.aictePoints;
            }
        }
    });

    return this.totalPoints;
};

// Method to get progress
StudentSchema.methods.getProgress = function () {
    const target = 100;
    this.calculateTotalPoints();
    return {
        current: this.totalPoints,
        target,
        percentage: Math.min((this.totalPoints / target) * 100, 100),
        remaining: Math.max(target - this.totalPoints, 0),
    };
};

module.exports = mongoose.model('Student', StudentSchema);
