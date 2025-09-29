# CaneMap - Smart Sugarcane Field Management System

CaneMap is a comprehensive digital platform designed for managing sugarcane fields, tracking farming activities, and facilitating communication between farmers, landowners, and SRA (Sugar Regulatory Administration) officers.

## 🌾 Features

### Core Functionality

* **Interactive Field Mapping**: Visual representation of sugarcane fields using Leaflet.js and OpenStreetMap
* **Field Registration**: Complete field registration with document upload and SRA review process
* **Task Logging**: Daily activity tracking with photo documentation
* **Report Submission**: Cost and production report generation for SRA compliance
* **Role-Based Access**: Different dashboards for farmers, field owners, and SRA officers

### User Roles & Permissions

#### 👨‍🌾 Farmers (All Users)

* Register and manage sugarcane fields
* Join existing fields as workers
* Log daily activities with photos
* Submit cost and production reports
* View field maps and progress

#### 🏡 Field Owners

* Approve worker join requests
* View task logs and field activities
* Manage field information
* Submit reports for their fields

#### 👨‍💼 SRA Officers

* Review field registrations and documents
* Mark submissions as reviewed
* View and review cost/production reports
* Read-only access to all field data

---

## 🔥 Supabase Reports System (New)

The reports system has been modernized with **Supabase integration**, providing a fully client-side solution for cost and production reporting.

### Key Features

* **Supabase Authentication**: Secure user management with automatic session handling
* **Real-time Data**: Instant updates using Supabase Realtime or `onSnapshot` listeners
* **Storage**: File uploads securely stored in Supabase Storage
* **Access Control**: Field-level permissions based on ownership or approved worker status
* **Modern UI**: Enhanced user experience with real-time validation and feedback

### Reports Types

#### Cost of Production Reports

* Field selection with access control
* Cost breakdown (fertilizer, labor, equipment, other)
* Automatic total calculation
* Optional document uploads (PDF, images)
* Real-time form validation

#### Production Reports

* Harvest area and yield tracking
* Date and variety selection
* Optional harvest proof photos
* Automatic field access validation
* Instant submission feedback

### Technical Implementation

* **Frontend**: `public/views/reports.html` - Modern, responsive interface
* **Backend**: `public/backend/reports.js` - Supabase operations and business logic
* **Architecture**: ES6 modules with async/await patterns
* **Security**: Supabase Row Level Security (RLS) policies
* **Performance**: Optimized queries and real-time updates

### Migration Benefits

* **Scalability**: Cloud-based infrastructure
* **Reliability**: Supabase global infrastructure
* **Maintenance**: Reduced server management overhead
* **Security**: Built-in authentication and authorization
* **Performance**: Fast, responsive user experience

---

## 🔗 Supabase Join Field System (New)

The Join Field functionality has been converted to **Supabase**, allowing users to request access to sugarcane fields they don't own.

### Key Features

* **Field Discovery**: Browse available fields with interactive map
* **Join Requests**: Submit requests to work on fields
* **Real-time Updates**: Instant status updates using Supabase Realtime
* **Access Control**: Field-level permissions and request management
* **Interactive Maps**: Leaflet.js integration for field visualization

### System Components

* **Frontend**: `public/join-field.html` - User interface for field joining
* **Backend**: `public/backend/join-field.js` - Supabase operations and business logic
* **Configuration**: `public/backend/supabase-config.js` - Supabase setup and initialization

### Supabase Tables Used

#### Fields Table

```javascript
{
  id: "uuid",
  field_name: "string",
  barangay: "string", 
  municipality: "string",
  area_size: "number",
  owner_id: "uuid", // Supabase Auth UID of field owner
  crop_variety: "string", // optional
  status: "active" | "sra_reviewed" | "inactive",
  latitude: "number", // optional
  longitude: "number", // optional
  created_at: "timestamp"
}
```

#### Field Workers Table

```javascript
{
  id: "uuid",
  field_id: "uuid", // Reference to fields table
  user_id: "uuid", // Supabase Auth UID
  status: "pending" | "approved" | "rejected",
  requested_at: "timestamp"
}
```

### Features

#### Available Fields

* Displays all fields with status 'active' or 'sra_reviewed'
* Excludes fields owned by the current user
* Shows field details: name, location, area, owner, crop variety
* Allows users to submit join requests

#### Join Requests

* Prevents duplicate requests for the same field
* Shows pending, approved, and rejected requests
* Displays request date and status
* Links to task logging for approved requests

#### Interactive Map

* Uses Leaflet.js for map display
* Shows field locations with markers
* Popup information with join request button
* Centered on Philippines coordinates

### Security Policies

* Row Level Security (RLS) policies enforce:

  * Users can read all fields
  * Field owners can modify their fields
  * Users can manage their own join requests
  * Field owners can approve/reject requests for their fields

---

## 📝 Supabase Task Logging System (New)

The Task Logging system has been converted to **Supabase**, enabling users to record and track daily farming activities with photo documentation.

### Key Features

* **Activity Tracking**: Log daily tasks with detailed descriptions
* **Photo Documentation**: Upload selfies and field photos for verification
* **Status Management**: Track task completion status (Done, In Progress, Not Yet Done, Delayed)
* **Real-time Updates**: Instant task log updates using Supabase Realtime
* **Field Access Control**: Verify user permissions before allowing task logging
* **Interactive Map**: Display field location with Leaflet.js integration

### Supabase Tables Used

#### Task Logs Table

```javascript
{
  id: "uuid",
  field_id: "uuid", // Reference to fields table
  user_id: "uuid", // Supabase Auth UID
  task_name: "string",
  description: "string",
  task_status: "done" | "in_progress" | "not_yet_done" | "delayed",
  selfie_path: "string", // Supabase Storage URL
  field_photo_path: "string", // Supabase Storage URL
  worker_name: "string",
  field_name: "string",
  logged_at: "timestamp"
}
```

### Features

* Form validation for required fields
* File upload support for selfies and field photos
* Automatic user identification and field association
* Real-time feedback and error handling
* Chronological display of all tasks for a field
* Status indicators with color coding

### Security Features

* **Authentication Required**: Only authenticated users can access
* **Field-level Permissions**: Users can only log tasks for accessible fields
* **File Upload Security**: Images stored securely in Supabase Storage
* **Data Validation**: Client and server-side validation

---

## 🚀 Supabase Setup (New System)

### 1. Project Setup

1. Create a Supabase project at [https://supabase.com](https://supabase.com)
2. Enable **Authentication**, **Database (PostgreSQL)**, and **Storage**
3. Copy the Supabase URL and API Key to `supabase-config.js`

### 2. Database & Storage

* Create tables: `fields`, `field_workers`, `task_logs`, `cost_reports`, `production_reports`
* Configure Supabase Storage for `task_photos`, `cost_reports`, `production_reports`

### 3. Row Level Security

* Enable RLS on all tables
* Set policies for:

  * Users managing only their records
  * Field owners controlling their fields
  * Approved workers accessing field tasks

### 4. Authentication

* Enable **Email/Password** authentication
* Store user roles (`farmer`, `field_owner`, `sra_officer`) in Supabase profile
