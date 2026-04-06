# PointMate - AICTE Points Tracker for VTU Students

PointMate is a comprehensive platform designed to help Vishweswaraya Technological University (VTU) students track and manage their AICTE Activity Points. It streamlines the process of discovering events, logging activities, and managing participation certificates, ensuring students meet their graduation requirements effortlessly.

---

## 📸 App Preview

### 🏠 Homepage
![Homepage](screenshots/homepage.png)

---

### 📅 Events Page
![Events Page](screenshots/events_page.png)

---

### 🎓 Student Dashboard
![Student Dashboard](screenshots/student_dashboard.png)

---

### 📋 Activity Log
![Activity Log](screenshots/activity_log.png)

---

### 🏅 Certificates Page
![Certificates Page](screenshots/certificates_page.png)

---

### 📝 Self Report Page
![Self Report Page](screenshots/self_report.png)

---

### 🏢 Organization Dashboard
![Organization Dashboard](screenshots/org_dashboard.png)

---

### ➕ Organization – Event Creation
![Event Creation Page](screenshots/org_event_creation.png)

---

### ⚙️ Organization – Event Management
![Event Management Page](screenshots/org_event_management.png)

---

## 🚀 Features

### For Students
- **Smart Dashboard**: Real-time visualization of AICTE points progress with a dynamic circular tracker.
- **Activity Timeline**: A premium, connected timeline showing recent engagements and their status (Approved/Pending).
- **Points Tracker**: Detailed breakdown of points earned across different AICTE categories.
- **Certificate Vault**: Secure storage and management of participation certificates and event photos.
- **Self-Reported Activities**: Ability to claim points for activities done outside the platform with AI-assisted validation.
- **Live Notifications**: Instant alerts for attendance marking, activity approvals, and upcoming events.

### For Organizations (Colleges/NGOs/Bodies)
- **Event Management**: Easily create and manage AICTE-approved campus events.
- **AI-Validation**: Platform uses Google's Generative AI to ensure events meet official AICTE guidelines before posting.
- **Attendance System**: Quick attendance marking for students, which automatically syncs points to their profiles.
- **Registration Review**: Streamlined interface to approve or reject student event registrations.
- **Activity Verification**: Review self-reported activity claims from students.

---

## 🛠️ Tech Stack

### Frontend
- **React.js**: Core UI library.
- **Vite**: Modern frontend build tool.
- **Tailwind CSS**: Modern utility-first styling.
- **Framer Motion**: Smooth animations.
- **Lucide React**: Clean iconography.
- **React Hook Form**: Efficient form management.
- **Axios**: API communication.

### Backend
- **Node.js**: Server-side runtime.
- **Express.js**: Backend framework.
- **MongoDB & Mongoose**: NoSQL database and ORM.
- **JWT**: Secure token-based authentication.
- **Cloudinary**: Cloud-based media storage (Posters/Certificates).
- **Google Generative AI**: AI engine for event validation.

---

## ⚙️ Setup & Installation

### Prerequisites
- Node.js (v18+)
- MongoDB (Local or Atlas)
- Cloudinary Account (for media uploads)

### 1. Clone the repository
```bash
git clone <repository-url>
cd Pointmate
```

### 2. Backend Setup
```bash
# Install backend dependencies
npm install

# Setup environment variables
cp .env.example .env
# Edit .env and add your MongoDB URL, JWT Secret, Cloudinary credentials, and Gemini API Key
```

### 3. Frontend Setup
```bash
cd frontend
# Install frontend dependencies
npm install
```

### 4. Running the Project
```bash
# Run Backend (from root)
npm run dev

# Run Frontend (from /frontend)
npm run dev
```

---

## 📂 Project Structure

```text
Pointmate/
├── config/             # Database and Cloudinary configurations
├── controllers/        # Backend business logic
├── models/             # Mongoose schemas
├── routes/             # API endpoints
├── utils/              # Helper functions and AI validators
├── uploads/            # Local storage fallback for media
├── frontend/           # React application
│   ├── src/
│   │   ├── components/ # Reusable UI components
│   │   ├── context/    # Auth and State management
│   │   ├── services/   # API service layer
│   │   └── pages/      # Main dashboard and landing pages
└── server.js           # Server entry point
```

---

## 📄 License
This project is licensed under the ISC License.

---

## 🌟 Acknowledgement
Developed to simplify the academic journey for VTU students.
