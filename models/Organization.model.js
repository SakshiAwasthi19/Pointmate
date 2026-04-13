const mongoose = require('mongoose');

const OrganizationSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        unique: true,
    },
    institutionName: {
        type: String,
        required: [true, 'Institution name is required'],
        trim: true,
    },
    organizationEmail: {
        type: String,
        required: true,
    },
    aicteApprovalNumber: {
        type: String,
        required: [true, 'AICTE Approval Number is required'],
        unique: true,
        trim: true,
    },
    fullName: {
        type: String, // Contact person full name
        required: [true, 'Full Name (Organization Contact) is required'],
        trim: true,
    },
    designation: {
        type: String,
        required: [true, 'Designation is required'],
        trim: true,
    },
    authorizedPersonName: {
        type: String, // Can be same as fullName or specific authorized signatory
        required: [true, 'Authorized Person Name is required'],
        trim: true,
    },
    contactNumber: {
        type: String,
        required: [true, 'Contact number is required'],
    },
    organizationLogo: {
        url: String,
        publicId: String,
    },
    organizationType: {
        type: String,
        enum: ['College/University', 'NGO', 'Corporate', 'Government Body', 'Student Organization', 'Professional Body', 'Other'],
    },
    description: String,
    website: String,
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
        address: { type: String },
        city: String,
        state: String,
        pincode: String,
    },
    socialMedia: {
        facebook: String,
        twitter: String,
        instagram: String,
        linkedin: String,
    },
    verificationStatus: {
        type: String,
        enum: ['pending', 'verified', 'rejected'],
        default: 'pending',
    },
    eventsHosted: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Event',
    }],
    rating: {
        average: { type: Number, default: 0, min: 0, max: 5 },
        count: { type: Number, default: 0 },
    },
    school_id: {
        type: String,
        required: [true, 'School ID is required'],
        index: true,
    },
}, { 
    timestamps: true 
});

// Index for geospacial queries
OrganizationSchema.index({ location: '2dsphere' });

module.exports = mongoose.model('Organization', OrganizationSchema);
