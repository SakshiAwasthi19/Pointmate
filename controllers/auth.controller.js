const User = require('../models/User.model');
const Student = require('../models/Student.model');
const Organization = require('../models/Organization.model');
const { generateToken } = require('../middleware/auth.middleware');

// @desc Register
exports.register = async (req, res) => {
    try {
        const { email, password, userType, school_id, collegeName, ...profileData } = req.body;

        const finalSchoolId = school_id || collegeName || "DEFAULT_SCHOOL";

        // Validation
        if (!email || !password || !userType) {
            return res.status(400).json({
                success: false,
                message: 'Please provide email, password and user type'
            });
        }

        if (!['student', 'organization'].includes(userType)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid user type'
            });
        }

        // Check existing user
        const userExists = await User.findOne({ email });
        if (userExists) {
            return res.status(400).json({
                success: false,
                message: 'Email already registered'
            });
        }

        // Create user
        const user = await User.create({
            email,
            password,
            userType,
            school_id: finalSchoolId
        });

        let profile;

        try {
            if (userType === 'student') {
                profile = await Student.create({
                    userId: user._id,
                    email: user.email,
                    school_id: finalSchoolId,

                    // FIX 1: collegeName
                    collegeName: collegeName?.trim() || finalSchoolId,

                    // FIX 2: GEO LOCATION (CRITICAL)
                    location: {
                        type: "Point",
                        coordinates: [0, 0]
                    },

                    ...profileData
                });
            } else {
                profile = await Organization.create({
                    userId: user._id,
                    organizationEmail: user.email,
                    school_id: finalSchoolId,
                    ...profileData
                });
            }
        } catch (profileError) {
            await User.findByIdAndDelete(user._id);

            if (profileError.code === 11000) {
                const field = Object.keys(profileError.keyPattern)[0];
                return res.status(400).json({
                    success: false,
                    message: `Duplicate value for ${field}`
                });
            }

            throw profileError;
        }

        const token = generateToken(user._id, user.userType);

        res.status(201).json({
            success: true,
            token,
            user: {
                id: user._id,
                email: user.email,
                userType: user.userType
            },
            profile
        });

    } catch (err) {
        console.error('Register Error:', err.message);
        res.status(500).json({
            success: false,
            message: 'Server error during registration',
            error: err.message
        });
    }
};

// LOGIN
exports.login = async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ success: false, message: 'Provide email & password' });
        }

        const user = await User.findOne({ email }).select('+password');
        if (!user) return res.status(401).json({ success: false, message: 'Invalid credentials' });

        const isMatch = await user.comparePassword(password);
        if (!isMatch) return res.status(401).json({ success: false, message: 'Invalid credentials' });

        if (!user.isActive) {
            return res.status(403).json({ success: false, message: 'Account deactivated' });
        }

        let profile;
        if (user.userType === 'student') {
            profile = await Student.findOne({ userId: user._id });
        } else {
            profile = await Organization.findOne({ userId: user._id });
        }

        if (!profile) {
            return res.status(404).json({ success: false, message: 'Profile not found' });
        }

        await user.updateLastLogin();

        const token = generateToken(user._id, user.userType);

        res.status(200).json({
            success: true,
            token,
            user: {
                id: user._id,
                email: user.email,
                userType: user.userType
            },
            profile
        });

    } catch (err) {
        console.error('Login Error:', err.message);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

// GET CURRENT USER
exports.getCurrentUser = async (req, res) => {
    try {
        const user = await User.findById(req.user.userId);

        let profile;
        if (user.userType === 'student') {
            profile = await Student.findOne({ userId: user._id });
        } else {
            profile = await Organization.findOne({ userId: user._id });
        }

        res.status(200).json({
            success: true,
            data: { user, profile }
        });

    } catch (err) {
        console.error('Get Me Error:', err.message);
        res.status(500).json({ success: false });
    }
};

// CHANGE PASSWORD
exports.changePassword = async (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body;

        if (!currentPassword || !newPassword) {
            return res.status(400).json({ success: false });
        }

        const user = await User.findById(req.user.userId).select('+password');

        const isMatch = await user.comparePassword(currentPassword);
        if (!isMatch) {
            return res.status(401).json({ success: false });
        }

        user.password = newPassword;
        await user.save();

        res.status(200).json({
            success: true,
            message: 'Password updated'
        });

    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false });
    }
};