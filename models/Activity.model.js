const mongoose = require('mongoose');

const ActivitySchema = new mongoose.Schema({
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
    title: {
        type: String,
        required: [true, 'Activity title is required'],
        trim: true,
    },
    description: {
        type: String,
        trim: true,
    },
    domain: {
        type: String,
        enum: ['Technical', 'Soft Skills', 'Community Service', 'Cultural', 'Sports', 'Environmental'],
        required: true,
        index: true,
    },
    aictePoints: {
        type: Number,
        required: true,
        min: 0,
    },
    date: {
        type: Date,
        required: true,
        index: true,
    },
    semester: {
        type: Number,
        required: true,
        min: 1,
        max: 8,
    },
    certificates: [{
        url: String,
        publicId: String,
        uploadedAt: { type: Date, default: Date.now },
    }],
    photos: [{
        url: String,
        publicId: String,
        uploadedAt: { type: Date, default: Date.now },
    }],
    eventId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Event',
        index: true,
    },
    status: {
        type: String,
        enum: ['pending', 'approved', 'rejected'],
        default: 'pending',
        index: true,
    },
    remarks: {
        type: String,
        trim: true,
    },
}, { 
    timestamps: true 
});

// Compound index for unique verification if needed (e.g., same student, same event)
ActivitySchema.index({ studentId: 1, eventId: 1 }, { unique: true, sparse: true });

module.exports = mongoose.model('Activity', ActivitySchema);
