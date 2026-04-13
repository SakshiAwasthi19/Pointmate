const User = require('../models/User.model');
const Student = require('../models/Student.model');
const Organization = require('../models/Organization.model');
const { generateToken } = require('../middleware/auth.middleware');

// @desc    Register a new user (Student or Organization)
// @route   POST /api/auth/register
// @access  Public
exports.register = async (req, res) => {
    try {
        // ✅ Extract fields
        const { email, password, userType, school_id, collegeName, ...profileData } = req.body;

        // ✅ Fallback for school_id
        const finalSchoolId = school_id || collegeName || "DEFAULT_SCHOOL";

        // 1. Validation
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

        // 2. Check if user exists
        const userExists = await User.findOne({ email });
        if (userExists) {
            return res.status(400).json({
                success: false,
                message: 'Email already registered'
            });
        }

        // 3. Create User (✅ FIXED)
        const user = await User.create({
            email,
            password,
            userType,
            school_id: finalSchoolId
        });

        // 4. Create Profile
        let profile;
        try {
            if (userType === 'student') {
                profile = await Student.create({
                    userId: user._id,
                    email: user.email,
                    school_id: finalSchoolId,

                    // ✅ CRITICAL FIX (collegeName fallback)
                    collegeName: collegeName?.trim() || finalSchoolId,

                    ...profileData
                });
            } else if (userType === 'organization') {
                profile = await Organization.create({
                    userId: user._id,
                    organizationEmail: user.email,
                    school_id: finalSchoolId,
                    ...profileData
                });
            }
        } catch (profileError) {
            // Rollback user if profile fails
            await User.findByIdAndDelete(user._id);

            if (profileError.code === 11000) {
                const field = Object.keys(profileError.keyPattern)[0];
                return res.status(400).json({
                    success: false,
                    message: `Duplicate value for ${field}. Please use unique credentials.`
                });
            }

            throw profileError;
        }

        // 5. Generate Token
        const token = generateToken(user._id, user.userType);

        // 6. Response
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

// LOGIN (unchanged)
exports.login = async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({
                success: false,
                message: 'Please provide email and password'
            });
        }

        const user = await User.findOne({ email }).select('+password');
        if (!user) {
            return res.status(401).json({ success: false, message: 'Invalid credentials' });
        }

        const isMatch = await user.comparePassword(password);
        if (!isMatch) {
            return res.status(401).json({ success: false, message: 'Invalid credentials' });
        }

        if (!user.isActive) {
            return res.status(403).json({ success: false, message: 'Account is deactivated' });
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
        res.status(500).json({ success: false, message: 'Server error during login' });
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
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

// CHANGE PASSWORD
exports.changePassword = async (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body;

        if (!currentPassword || !newPassword) {
            return res.status(400).json({ success: false, message: 'Provide both passwords' });
        }

        const user = await User.findById(req.user.userId).select('+password');

        const isMatch = await user.comparePassword(currentPassword);
        if (!isMatch) {
            return res.status(401).json({ success: false, message: 'Incorrect current password' });
        }

        user.password = newPassword;
        await user.save();

        res.status(200).json({
            success: true,
            message: 'Password updated successfully'
        });

    } catch (err) {
        console.error('Change pwd Error:', err.message);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};