const mongoose = require('mongoose');

const EventRegistrationSchema = new mongoose.Schema({
    studentId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Student',
        required: true,
    },
    registeredAt: {
        type: Date,
        default: Date.now,
    },
    passId: { type: String },
    attended: {
        type: Boolean,
        default: false,
    },
    status: {
        type: String,
        enum: ['pending', 'approved', 'rejected'],
        default: 'pending',
    },
    feedback: {
        rating: { type: Number, min: 1, max: 5 },
        comment: String,
        submittedAt: Date,
    },
}, { _id: true });

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
    status: {
        type: String,
        enum: ['approved', 'pending', 'rejected', 'completed'],
        default: 'pending',
        index: true,
    },
    registeredStudents: {
        type: [EventRegistrationSchema],
        default: [],
    },
    views: {
        type: Number,
        default: 0,
    },
    aiValidation: {
        passed: Boolean,
        confidence: Number,
        matchedCategory: String,
        validatedAt: Date,
        remarks: String,
    },
    rating: {
        average: { type: Number, default: 0, min: 0, max: 5 },
        count: { type: Number, default: 0 },
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
    const validStatuses = ['approved', 'pending'];
    // Legacy docs created before `status` was in schema may have no status in DB
    const status = this.status != null ? this.status : 'approved';
    if (!validStatuses.includes(status)) {
        return false;
    }

    const now = Date.now();
    const endMs = this.endDateTime ? new Date(this.endDateTime).getTime() : NaN;
    const deadlineMs = this.registrationDeadline ? new Date(this.registrationDeadline).getTime() : NaN;

    const beforeEnd = !Number.isNaN(endMs) ? now < endMs : true;
    const beforeDeadline = !Number.isNaN(deadlineMs) ? now < deadlineMs : true;

    return beforeEnd && beforeDeadline && !this.isFull();
};

// Method to check if student is registered
EventSchema.methods.isStudentRegistered = function (studentId) {
    const list = this.registeredStudents;
    if (!Array.isArray(list) || list.length === 0) return false;
    const sid = studentId && studentId.toString();
    return list.some((reg) => {
        const regStudent = reg.studentId;
        const regId = regStudent && (regStudent._id != null ? regStudent._id : regStudent);
        return regId && regId.toString() === sid;
    });
};

// Method to update rating
EventSchema.methods.updateRating = function () {
    const list = Array.isArray(this.registeredStudents) ? this.registeredStudents : [];
    const feedbacks = list.filter(r => r.feedback && r.feedback.rating);
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
