import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Calendar, MapPin, ArrowRight, Upload, AlertCircle, Info } from 'lucide-react'
import { organizationAPI } from '../../services/api'
import toast from 'react-hot-toast'
import LoadingSpinner from '../common/LoadingSpinner'

const CreateEvent = () => {
    const navigate = useNavigate()
    const [loading, setLoading] = useState(false)
    const [posterFile, setPosterFile] = useState(null)
    const [posterPreview, setPosterPreview] = useState('')
    const [formData, setFormData] = useState({
        title: '',
        description: '',
        domain: 'Technical',
        aictePoints: '',
        posterUrl: '',
        startDateTime: '',
        endDateTime: '',
        location: '',
        registrationDeadline: ''
    })
    const [validationResult, setValidationResult] = useState(null)

    const domains = [
        'Technical',
        'Soft Skills',
        'Community Service',
        'Cultural',
        'Sports',
        'Environmental',
        'Other'
    ]

    const handleChange = (e) => {
        const { name, value } = e.target
        setFormData(prev => ({ ...prev, [name]: value }))
    }

    const handlePosterChange = (e) => {
        const file = e.target.files[0]
        if (file) {
            if (file.size > 5 * 1024 * 1024) {
                toast.error('File size must be less than 5MB');
                return;
            }
            setPosterFile(file)
            const reader = new FileReader()
            reader.onloadend = () => {
                setPosterPreview(reader.result)
            }
            reader.readAsDataURL(file)
        }
    }

    const handleSubmit = async (e) => {
        e.preventDefault()
        setValidationResult(null); // Reset previous validation

        // Validation
        if (!formData.title || !formData.description || !formData.domain ||
            !formData.aictePoints || !formData.startDateTime ||
            !formData.endDateTime || !formData.location) {
            toast.error('Please fill all required fields')
            return
        }

        if (!posterFile && !formData.posterUrl) {
            toast.error('Please upload a poster or provide poster URL')
            return
        }

        try {
            setLoading(true)

            // Create FormData for file upload
            const data = new FormData()
            data.append('title', formData.title)
            data.append('description', formData.description)
            data.append('domain', formData.domain)
            data.append('aictePoints', formData.aictePoints)
            data.append('startDateTime', formData.startDateTime)
            data.append('endDateTime', formData.endDateTime)

            // Parse location into structured format
            const locationData = {
                venue: formData.location,
                coordinates: [0, 0] // Placeholder for now
            }
            data.append('location', JSON.stringify(locationData))

            if (posterFile) {
                data.append('poster', posterFile)
            } else if (formData.posterUrl) {
                data.append('posterUrl', formData.posterUrl)
            }

            // Registration closes when the event ends (no separate deadline field in UI).
            // Using endDateTime avoids closing signup a day before the event starts.
            const deadline = new Date(formData.endDateTime || formData.startDateTime)
            data.append('registrationDeadline', deadline.toISOString())

            const response = await organizationAPI.createEvent(data)

            // Check for AI validation result in response
            // Backend (EventController) should be returning { success: true, data: event, validation: {...} } or similar
            // The provided walkthrough code implies getting it from response.data.aiValidation often

            let validation = response.data?.aiValidation || response.aiValidation;

            if (validation) {
                setValidationResult(validation)

                if (validation.passed && validation.confidence >= 80) {
                    toast.success(`Event created successfully! AI Confidence: ${validation.confidence}%`)
                    setTimeout(() => {
                        navigate('/organization/events')
                    }, 2000)
                } else {
                    // It might be created but flagged "pending" or similar
                    toast.success(`Event submitted but requires review. Confidence: ${validation.confidence}%`)
                }
            } else {
                // Fallback if no validation data
                toast.success('Event created successfully!');
                setTimeout(() => {
                    navigate('/organization/events')
                }, 1000)
            }

        } catch (error) {
            console.error('Create event error:', error)

            // Check for AI validation failure specifically
            if (error.response?.data?.aiValidation) {
                const validation = error.response.data.aiValidation;
                setValidationResult(validation);

                // Show specific popup message as requested
                toast.error(
                    `Event Validation Failed!\n\nThis event does not meet AICTE guidelines (${validation.confidence}% confidence).\n\nPlease review the description and try again.`,
                    { duration: 6000 }
                );
            } else {
                toast.error(error.response?.data?.message || 'Failed to create event');
            }
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="animate-fade-in">
            {/* Header */}
            <div className="mb-8">
                <h1 className="text-3xl font-bold text-gray-900 mb-2">
                    Organization Dashboard
                </h1>
                <p className="text-gray-600">
                    Manage your events and track participant registrations
                </p>
            </div>

            {/* Create Event Form */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-8 mb-8">
                <h2 className="text-2xl font-bold text-gray-900 mb-6 border-b border-gray-50 pb-4">Create New Event</h2>

                <form onSubmit={handleSubmit} className="space-y-8">
                    {/* AI Validation Result */}
                    {validationResult && (
                        <div className={`p-4 rounded-lg border-l-4 animate-slide-up ${validationResult.passed
                            ? 'bg-green-50 border-green-600'
                            : 'bg-red-50 border-red-600'
                            }`}>
                            <div className="flex items-start">
                                <AlertCircle className={`w-5 h-5 mt-0.5 mr-3 flex-shrink-0 ${validationResult.passed ? 'text-green-600' : 'text-red-600'
                                    }`} />
                                <div>
                                    <p className={`font-bold ${validationResult.passed ? 'text-green-900' : 'text-red-900'
                                        }`}>
                                        AI Validation: {validationResult.confidence}% Confidence
                                    </p>
                                    <p className="text-sm text-gray-700 mt-1">
                                        {validationResult.reasoning}
                                    </p>
                                    {validationResult.matchedCategory && (
                                        <p className="text-sm text-gray-700 mt-1">
                                            Matched Category: <strong>{validationResult.matchedCategory}</strong>
                                        </p>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Event Information */}
                    <div>
                        <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center">
                            <Info className="w-5 h-5 mr-2 text-blue-600" />
                            Event Information
                        </h3>

                        {/* Event Title */}
                        <div className="mb-6">
                            <label className="block text-sm font-semibold text-gray-700 mb-2">
                                Event Title *
                            </label>
                            <input
                                type="text"
                                name="title"
                                value={formData.title}
                                onChange={handleChange}
                                required
                                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                                placeholder="e.g. Advanced Web Development Workshop"
                            />
                        </div>

                        {/* Description */}
                        <div className="mb-6">
                            <label className="block text-sm font-semibold text-gray-700 mb-2">
                                Description *
                            </label>
                            <textarea
                                name="description"
                                value={formData.description}
                                onChange={handleChange}
                                required
                                rows={5}
                                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                                placeholder="Describe your event in detail to help our AI classify it accurately..."
                            />
                        </div>

                        {/* Domain and Points */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-2">
                                    Domain *
                                </label>
                                <div className="relative">
                                    <select
                                        name="domain"
                                        value={formData.domain}
                                        onChange={handleChange}
                                        required
                                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 appearance-none bg-white"
                                    >
                                        {domains.map(domain => (
                                            <option key={domain} value={domain}>{domain}</option>
                                        ))}
                                    </select>
                                    <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-700">
                                        <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z" /></svg>
                                    </div>
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-2">
                                    AICTE Points *
                                </label>
                                <input
                                    type="number"
                                    name="aictePoints"
                                    value={formData.aictePoints}
                                    onChange={handleChange}
                                    required
                                    min="0"
                                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                                    placeholder="e.g. 10"
                                />
                            </div>
                        </div>
                    </div>

                    <hr className="border-gray-100" />

                    {/* Event Media */}
                    <div>
                        <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center">
                            <Upload className="w-5 h-5 mr-2 text-blue-600" />
                            Event Media
                        </h3>

                        {/* Poster Upload */}
                        <div className="mb-6">
                            <label className="block text-sm font-semibold text-gray-700 mb-2">
                                Upload Poster *
                            </label>
                            <div className="flex flex-col md:flex-row items-start md:items-center space-y-4 md:space-y-0 md:space-x-4">
                                <label className="flex-1 w-full md:w-auto flex flex-col items-center justify-center border-2 border-dashed border-blue-200 bg-blue-50/30 rounded-lg p-8 hover:bg-blue-50 hover:border-blue-300 cursor-pointer transition-all group">
                                    <div className="text-center">
                                        <div className="bg-white p-3 rounded-full shadow-sm inline-block mb-3 group-hover:scale-110 transition-transform">
                                            <Upload className="w-6 h-6 text-blue-600" />
                                        </div>
                                        <p className="text-sm font-medium text-gray-700">
                                            {posterFile ? posterFile.name : 'Click to upload poster image'}
                                        </p>
                                        <p className="text-xs text-gray-500 mt-1">PNG, JPG up to 5MB</p>
                                    </div>
                                    <input
                                        type="file"
                                        accept="image/*"
                                        onChange={handlePosterChange}
                                        className="hidden"
                                    />
                                </label>

                                {posterPreview && (
                                    <div className="w-full md:w-48 h-48 rounded-lg overflow-hidden border border-gray-200 shadow-sm flex-shrink-0">
                                        <img src={posterPreview} alt="Preview" className="w-full h-full object-cover" />
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="relative flex py-2 items-center">
                            <div className="flex-grow border-t border-gray-200"></div>
                            <span className="flex-shrink-0 mx-4 text-gray-400 text-xs uppercase font-bold tracking-wider">OR Use URL</span>
                            <div className="flex-grow border-t border-gray-200"></div>
                        </div>

                        {/* Poster URL */}
                        <div className="mt-4">
                            <label className="block text-sm font-semibold text-gray-700 mb-2">
                                Poster URL
                            </label>
                            <input
                                type="url"
                                name="posterUrl"
                                value={formData.posterUrl}
                                onChange={handleChange}
                                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                                placeholder="https://example.com/poster.jpg"
                            />
                        </div>
                    </div>

                    <hr className="border-gray-100" />

                    {/* Date and Location */}
                    <div>
                        <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center">
                            <Calendar className="w-5 h-5 mr-2 text-blue-600" />
                            Date and Location
                        </h3>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-2">
                                    Start Date and Time *
                                </label>
                                <div className="relative">
                                    <Calendar className="absolute left-3 top-3.5 w-5 h-5 text-gray-400 pointer-events-none" />
                                    <input
                                        type="datetime-local"
                                        name="startDateTime"
                                        value={formData.startDateTime}
                                        onChange={handleChange}
                                        required
                                        className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-2">
                                    End Date and Time *
                                </label>
                                <div className="relative">
                                    <Calendar className="absolute left-3 top-3.5 w-5 h-5 text-gray-400 pointer-events-none" />
                                    <input
                                        type="datetime-local"
                                        name="endDateTime"
                                        value={formData.endDateTime}
                                        onChange={handleChange}
                                        required
                                        className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                                    />
                                </div>
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-2">
                                Location *
                            </label>
                            <div className="relative">
                                <MapPin className="absolute left-3 top-3.5 w-5 h-5 text-gray-400 pointer-events-none" />
                                <input
                                    type="text"
                                    name="location"
                                    value={formData.location}
                                    onChange={handleChange}
                                    required
                                    className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                                    placeholder="Enter event venue (e.g. Building A, Auditorium)"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Submit Button */}
                    <div className="flex justify-end pt-4">
                        <button
                            type="submit"
                            disabled={loading}
                            className="btn-primary flex items-center space-x-2 px-8 py-4 text-lg shadow-lg hover:shadow-xl hover:-translate-y-0.5 transition-all"
                        >
                            {loading ? (
                                <>
                                    <LoadingSpinner size="sm" />
                                    <span>Validating & Creating...</span>
                                </>
                            ) : (
                                <>
                                    <span>Create Event</span>
                                    <ArrowRight className="w-5 h-5" />
                                </>
                            )}
                        </button>
                    </div>
                </form>
            </div>

            {/* Info Box */}
            <div className="bg-blue-50 border border-blue-100 p-5 rounded-xl flex items-start space-x-4">
                <div className="p-2 bg-blue-100 rounded-full flex-shrink-0">
                    <AlertCircle className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                    <h4 className="text-base font-bold text-blue-900 mb-1">AI Validation Process</h4>
                    <p className="text-sm text-blue-800 leading-relaxed">
                        All events are validated using AI to ensure they meet AICTE activity criteria.
                        Events achieving a confidence score of <strong>80% or higher</strong> are approved automatically.
                        Lower scores may require manual review.
                    </p>
                </div>
            </div>
        </div>
    )
}

export default CreateEvent
