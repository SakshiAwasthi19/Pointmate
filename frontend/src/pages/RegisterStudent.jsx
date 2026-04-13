import React from 'react';
import { useForm } from 'react-hook-form';
import { useAuth } from '../context/AuthContext';
import { Link, useNavigate } from 'react-router-dom';
import { authAPI } from '../services/api';
import toast from 'react-hot-toast';

const RegisterStudent = ({ embedded = false }) => {
    const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm();
    const navigate = useNavigate();

    const onSubmit = async (data) => {
        try {
            const payload = { ...data, userType: 'student', school_id: data.collegeName || data.institutionName };
            const response = await authAPI.register(payload);
            if (response.success) {
                toast.success('Registration Successful! Please Login.');
                navigate('/login');
            }
        } catch (error) {
            const message = error.response?.data?.message || 'Registration Failed';
            toast.error(message);
        }
    };

    const formContent = (
        <form className="mt-8 space-y-6" onSubmit={handleSubmit(onSubmit)}>
            <div className="grid grid-cols-1 gap-y-6 gap-x-4 sm:grid-cols-2">
                {/* Basic Info */}
                <div className="sm:col-span-2">
                    <h3 className="text-lg font-medium leading-6 text-gray-900 mb-2">Account Info</h3>
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700">Email</label>
                    <input
                        type="email"
                        {...register("email", {
                            required: "Email is required",
                            pattern: { value: /^\S+@\S+$/i, message: "Invalid email" }
                        })}
                        className="input-field mt-1"
                    />
                    {errors.email && <p className="text-red-500 text-xs mt-1">{errors.email.message}</p>}
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700">Password</label>
                    <input
                        type="password"
                        {...register("password", { required: "Password is required", minLength: { value: 6, message: "Min 6 chars" } })}
                        className="input-field mt-1"
                    />
                    {errors.password && <p className="text-red-500 text-xs mt-1">{errors.password.message}</p>}
                </div>

                {/* Personal Info */}
                <div className="sm:col-span-2">
                    <h3 className="text-lg font-medium leading-6 text-gray-900 mt-4 mb-2">Personal Details</h3>
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700">First Name</label>
                    <input
                        type="text"
                        {...register("firstName", { required: "First Name is required" })}
                        className="input-field mt-1"
                    />
                    {errors.firstName && <p className="text-red-500 text-xs mt-1">{errors.firstName.message}</p>}
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700">Last Name</label>
                    <input
                        type="text"
                        {...register("lastName", { required: "Last Name is required" })}
                        className="input-field mt-1"
                    />
                    {errors.lastName && <p className="text-red-500 text-xs mt-1">{errors.lastName.message}</p>}
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700">Student ID (USN)</label>
                    <input
                        type="text"
                        {...register("studentId", { required: "USN is required" })}
                        className="input-field mt-1"
                    />
                    {errors.studentId && <p className="text-red-500 text-xs mt-1">{errors.studentId.message}</p>}
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700">Phone</label>
                    <input
                        type="tel"
                        {...register("phoneNumber", { required: "Phone is required" })}
                        className="input-field mt-1"
                    />
                    {errors.phoneNumber && <p className="text-red-500 text-xs mt-1">{errors.phoneNumber.message}</p>}
                </div>

                <div className="sm:col-span-2">
                    <label className="block text-sm font-medium text-gray-700">College Name</label>
                    <input
                        type="text"
                        {...register("collegeName", { required: "College Name is required" })}
                        className="input-field mt-1"
                    />
                    {errors.collegeName && <p className="text-red-500 text-xs mt-1">{errors.collegeName.message}</p>}
                </div>

            </div>

            <div>
                <button
                    type="submit"
                    disabled={isSubmitting}
                    className="btn-primary w-full"
                >
                    {isSubmitting ? 'Creating Account...' : 'Register'}
                </button>
            </div>
        </form>
    );

    if (embedded) {
        return formContent;
    }

    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
            <div className="max-w-2xl w-full space-y-8 bg-white p-8 rounded-xl shadow-lg border border-gray-100 animate-slide-up">
                <div>
                    <h2 className="text-center text-3xl font-extrabold text-gray-900">
                        Create Student Account
                    </h2>
                    <p className="mt-2 text-center text-sm text-gray-600">
                        Already have an account?{' '}
                        <Link to="/login" className="font-medium text-primary-600 hover:text-primary-500">
                            Sign in
                        </Link>
                    </p>
                </div>

                {formContent}
            </div>
        </div>
    );
};

export default RegisterStudent;
