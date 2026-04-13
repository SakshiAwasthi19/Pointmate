const mongoose = require('mongoose');

const EventSchema = new mongoose.Schema({
    organizationId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Organization',
        required: true,
        index: true,
    },
    title: {
        type: String,
        required: [true, 'Event title is required'],
        trim: true,
    },
    description: {
        type: String,
        required: [true, 'Event description is required'],
    },
    domain: {
        type: String,
        enum: ['Technical', 'Soft Skills', 'Community Service', 'Cultural', 'Sports', 'Environmental', 'Other'],
        required: [true, 'Event domain is required'],
        index: true,
    },
    aictePoints: {
        type: Number,
        required: [true, 'AICTE Points value is required'],
        min: 0,
    },
    poster: {
        url: { type: String, required: true },
        publicId: String,
    },
    organizedBy: {
        type: String,
        required: true, // Should be auto-filled from Organization model
    },
    location: {
        type: {
            type: String,
            enum: ['Point'],
            default: 'Point',
        },
        coordinates: {
            type: [Number], // [longitude, latitude]
            required: true,
            index: '2dsphere',
        },
        venue: { type: String, required: true },
        address: String,
        city: String,
        state: String,
    },
    startDateTime: {
        type: Date,
        required: [true, 'Start date and time is required'],
        index: true,
    },
    endDateTime: {
        type: Date,
        required: [true, 'End date and time is required'],
    },
    registrationDeadline: {
        type: Date,
        required: [true, 'Registration deadline is required'],
    },
    mode: {
        type: String,
        enum: ['offline', 'online', 'hybrid'],
        default: 'offline',
    },
    onlineLink: String,
    maxParticipants: Number,
    tags: [String],
    prerequisites: [String],
    schedule: [{
        date: Date,
        time: String,
        activity: String,
        speaker: String,
    }],
    speakers: [{
        name: String,
        designation: String,
        organization: String,
        photo: String,
        bio: String,
    }],
    school_id: {
        type: String,
        required: [true, 'School ID is required'],
        index: true,
    },
    featured: {
        type: Boolean,
        default: false,
    },
}, { 
    timestamps: true, 
    toJSON: { virtuals: true }, 
    toObject: { virtuals: true } 
});

// Virtual for registration count
EventSchema.virtual('registrationCount').get(function () {
    return this.registeredStudents ? this.registeredStudents.length : 0;
});

// Virtual for available spots
EventSchema.virtual('availableSpots').get(function () {
    if (!this.maxParticipants) return null; // Unlimited
    return Math.max(this.maxParticipants - (this.registeredStudents ? this.registeredStudents.length : 0), 0);
});

// Method to check if full
EventSchema.methods.isFull = function () {
    if (!this.maxParticipants) return false;
    return this.registrationCount >= this.maxParticipants;
};

// Method to check if registration is open
EventSchema.methods.isRegistrationOpen = function () {
    // DEV: Allow 'pending' status and registration until event ends
    const validStatuses = ['approved', 'pending'];
    return (
        validStatuses.includes(this.status) &&
        new Date() < this.endDateTime && // Relaxed from registrationDeadline
        !this.isFull()
    );
};

// Method to check if student is registered
EventSchema.methods.isStudentRegistered = function (studentId) {
    return this.registeredStudents.some(reg => reg.studentId.toString() === studentId.toString());
};

// Method to update rating
EventSchema.methods.updateRating = function () {
    const feedbacks = this.registeredStudents.filter(r => r.feedback && r.feedback.rating);
    if (feedbacks.length === 0) {
        this.rating.average = 0;
        this.rating.count = 0;
        return;
    }
    const sum = feedbacks.reduce((acc, curr) => acc + curr.feedback.rating, 0);
    this.rating.average = sum / feedbacks.length;
    this.rating.count = feedbacks.length;
};

// Geo Index
EventSchema.index({ location: '2dsphere' });

module.exports = mongoose.model('Event', EventSchema);
