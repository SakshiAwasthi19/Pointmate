const mongoose = require('mongoose');

const RegistrationSchema = new mongoose.Schema({
    eventId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Event',
        required: true,
        index: true,
    },
    studentId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Student',
        required: true,
        index: true,
    },
    school_id: {
        type: String,
        required: true,
        index: true,
    },
    registeredAt: {
        type: Date,
        default: Date.now,
        index: true,
    },
    passId: {
        type: String,
        unique: true,
        sparse: true, // For QR Code / Digital Pass
    },
    attended: {
        type: Boolean,
        default: false,
        index: true,
    },
    status: {
        type: String,
        enum: ['pending', 'approved', 'rejected'],
        default: 'pending',
        index: true,
    },
    feedback: {
        rating: { type: Number, min: 1, max: 5 },
        comment: String,
        submittedAt: Date,
    },
}, { 
    timestamps: true 
});

// Ensure a student can only register once per event
RegistrationSchema.index({ eventId: 1, studentId: 1 }, { unique: true });

module.exports = mongoose.model('Registration', RegistrationSchema);
