# SafetyCatch — Product Specification Document

## 1. Product Overview

### 1.1 Product Name
**SafetyCatch** — Enterprise Learning Management System (LMS)

### 1.2 Purpose
SafetyCatch is a role-based learning management platform purpose-built for safety training organizations. It enables administrators to manage courses, trainers to deliver content, mentors to evaluate student work, and students to complete structured learning programs — all within a unified, offline-capable web application.

### 1.3 Target Users
| Role | Description |
|------|-------------|
| **Admin** | Organization administrators who manage all content, users, cohorts, assignments, broadcasts, and analytics |
| **Trainer** | Subject matter experts who deliver course content (slides, SCORM presentations, videos, documents) |
| **Mentor** | Evaluators who grade student submissions, monitor progress, and provide feedback |
| **Student** | Learners who consume courses, complete assignments, and track their learning progress |

### 1.4 Core Value Proposition
- Structured course delivery with version-controlled content
- SCORM/iSpring content integration with fullscreen presentation tools
- Cohort-based enrollment with granular access control
- Mentor-student assignment evaluation workflow
- Offline-first PWA for field/remote learning
- Real-time compliance tracking through broadcast acknowledgements
- Comprehensive analytics for organizational learning oversight

---

## 2. Technical Architecture

### 2.1 Technology Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18 + TypeScript, Vite 6.3 |
| Styling | Tailwind CSS 4, shadcn/ui (Radix Primitives), Lucide Icons |
| Routing | React Router 7 (role-based portals) |
| Backend | Supabase (PostgreSQL, Auth, Storage, Edge Functions, RLS) |
| Object Storage | Cloudflare R2 (large SCORM packages, videos) |
| Offline Storage | IndexedDB (idb-keyval), Cache API, Service Worker |
| Charts | Recharts |
| E2E Testing | Playwright |
| Package Manager | pnpm |

### 2.2 Architecture Pattern
- **Single Page Application** with role-based portal routing
- **Serverless Backend** powered entirely by Supabase (no custom server)
- **Edge Functions** for R2 presigned URL generation and multipart uploads
- **Progressive Web App** with offline-first design for students and trainers

---

## 3. Authentication & Authorization

### 3.1 Authentication Flow
1. User enters email/password on login page
2. Supabase Auth validates credentials via `signInWithPassword`
3. `AuthContext` fetches user's `role` and `must_reset_pw` from `profiles` table
4. If `must_reset_pw` is true → redirect to `/update-password`
5. Otherwise → redirect to `/{role}` portal

### 3.2 First-Time Login
- Admin creates users with temporary passwords
- On first login, user is forced to update their password
- `must_reset_pw` flag is set to `false` after successful password change

### 3.3 Role-Based Access Control
- `ProtectedRoute` component wraps each portal route
- Validates user session exists and role matches `allowedRoles`
- Mismatched roles are redirected to their correct portal
- Offline mode enforces current portal (no cross-portal navigation)

### 3.4 Row-Level Security (RLS)
All database tables enforce RLS policies:
- **Admins**: Full CRUD access to all tables
- **Trainers**: Read-only access to their assigned kits and modules
- **Mentors**: Read/write access to their assigned students' progress and submissions
- **Students**: Read access to their cohort's unlocked content; write access to own submissions

### 3.5 Offline Authentication
- Session, role, and `must_reset_pw` cached in `localStorage`
- Offline mode uses cached session to maintain authenticated state
- Offline vault is wiped on sign-out for security

---

## 4. Feature Specifications

### 4.1 Admin Portal

#### 4.1.1 Content Vault
**Purpose**: Central repository for all learning content, organized in a Course → Subject → Module hierarchy.

**Capabilities**:
- **Course Management**: Create, edit, archive courses (code, title, summary)
- **Subject Management**: Create subjects within courses, reorder via position
- **Module Management**: Create modules with format type (VIDEO, PPT, PDF, SCORM, LINK, QUIZ, SLIDES, DOCUMENT)
- **Version Control**: Upload new revisions with notes; system tracks version history (v1, v2, v3…); only one version marked as "current"
- **SCORM/iSpring Upload**: Folder-based upload via `ISpringUploader` — extracts files, injects CSS/JS patches, uploads to R2 with manifest
- **Status Workflow**: Draft → Published → Archived (with Under Review intermediate)
- **Trainer Assignment**: Assign one or more trainers to each module
- **Preview**: Inline preview of any version (PDF viewer, video player, iSpring iframe)

**Content Types Supported**:
| Type | Storage | Viewer |
|------|---------|--------|
| VIDEO | R2/Supabase Storage | HTML5 video player |
| PDF | Supabase Storage | Inline iframe viewer |
| PPT/SLIDES | R2 (converted SCORM) | iSpring Viewer |
| SCORM | R2 (folder structure) | iSpring Viewer (iframe) |
| LINK | URL reference | External link |
| QUIZ | Metadata only | Quiz engine (planned) |
| DOCUMENT | Supabase Storage | Download/inline preview |

#### 4.1.2 User Management
**Purpose**: Manage all platform users across roles.

**Capabilities**:
- **Mentor Management**: Add mentors (name, email, capacity), track current load vs capacity, "At Capacity" status
- **Student Management**: Add students (name, email, cohort assignment), view unassigned queue, bulk assignment to mentors
- **Trainer Management**: Add trainers (name, email), view assigned content count
- **Student-Mentor Assignment**: Drag/assign unassigned students to mentors; enforce capacity limits
- **Credential Generation**: Auto-generate temp passwords, copy to clipboard, force reset on first login
- **Cohort Enrollment**: Assign students to multiple cohorts via checkboxes

**User Creation Flow**:
1. Admin fills name + email
2. System generates temp password
3. Creates Supabase auth user + `profiles` row with `must_reset_pw: true`
4. Admin shares credentials with user
5. User logs in → forced to change password

#### 4.1.3 Assignments
**Purpose**: Create and distribute graded work to student cohorts.

**Capabilities**:
- Create assignment (title, description, due date, points)
- Select target cohorts (multi-select)
- Attach reference files (upload to Supabase Storage)
- Publish/Draft status toggle
- View enrolled students per assignment
- Track submission status per student

**Assignment Lifecycle**:
1. Admin creates assignment (Draft)
2. Admin attaches files and selects cohorts
3. Admin publishes → visible to enrolled students
4. Students submit work before due date
5. Mentors evaluate submissions

#### 4.1.4 News Publisher (Broadcasts)
**Purpose**: Organization-wide communication with acknowledgement tracking for compliance.

**Capabilities**:
- Compose announcements (title, body, priority, audience)
- Priority levels: Urgent, High, Normal, Low
- Audience targeting: All Staff, All Trainers, All Mentors, specific cohorts
- Acknowledgement tracking: who has acknowledged, who hasn't
- Compliance metrics: % acknowledged, outstanding count
- Per-recipient audit log

**Priority System**:
| Priority | Display | Behavior |
|----------|---------|----------|
| Urgent | Red badge, top of feed | Cannot be dismissed without acknowledging |
| High | Orange badge | Persistent until acknowledged |
| Normal | Blue badge | Standard display |
| Low | Gray badge | Can be dismissed |

#### 4.1.5 System Analytics
**Purpose**: Organizational oversight dashboard for learning operations.

**KPI Cards**:
- Outstanding Submissions (pending grading)
- Active Teaching Staff count
- Broadcast Compliance % (acknowledged / total recipients)
- Total Pending Reviews

**Visualizations**:
- **Assignment Throughput**: Stacked bar chart (submitted vs graded per week, 10-week window)
- **Mentor Grading Queue**: Per-mentor pending count + oldest waiting days
- **Staff Engagement Matrix**: Logins, session days, last seen, risk status (Active/Watch/At Risk)

**Data Sources**: Materialized views (`mv_weekly_throughput`), computed views (`vw_mentor_queue`, `vw_staff_engagement`)

---

### 4.2 Trainer Portal

#### 4.2.1 Dashboard
**Purpose**: Central hub for trainers to receive announcements and quick-launch content.

**Capabilities**:
- **Broadcast Feed**: View unread/critical announcements with acknowledge button
- **Clear Acknowledged**: Dismiss already-acknowledged broadcasts
- **Quick-Launch Cards**: Assigned slide decks with code, title, version badge
- **Navigate to Vault**: Direct link to full content vault

#### 4.2.2 Content Vault (Trainer View)
**Purpose**: Access assigned teaching materials organized by course.

**Capabilities**:
- View assigned Trainer Kits grouped by course
- **Slide Decks**: Version picker (v1, v2, v3…), launch into presentation mode
- **Videos**: Play assigned video content
- **Documents**: View/download PDFs and other documents
- Filter by content type tabs (Slides, Videos, Documents)

#### 4.2.3 iSpring/SCORM Viewer
**Purpose**: Fullscreen presentation delivery tool for trainers.

**Capabilities**:
- Iframe-based SCORM content rendering
- Fullscreen mode with custom toolbar injection
- **Laser Pointer**: Visual pointer that follows mouse (activated via toolbar)
- **Ink Annotations**: Freehand drawing overlay on slides
- **Navigation**: Custom next/prev controls, arrow key support
- **Watermark Removal**: CSS/JS injection removes iSpring trial watermarks
- **Resize Handling**: Notifies iframe of parent resize events for layout recalculation

---

### 4.3 Mentor Portal

#### 4.3.1 Dashboard
**Purpose**: Overview of mentoring responsibilities and alerts.

**Capabilities**:
- Pending evaluations count
- Cohort size and average progress %
- Stalling student count (flagged for inactivity)
- Broadcast feed with acknowledge
- Cohort health overview (on-track / stalling counts)
- Quick links to flagged students

#### 4.3.2 Cohort Roster
**Purpose**: Monitor all assigned students' progress.

**Capabilities**:
- Per-student progress bar (%)
- Last active timestamp (relative: "2h ago", "5d ago")
- Status badges: On Track (green), Stalling (amber), Awaiting Evaluation (blue)
- Click through to student profile

#### 4.3.3 Student Profile
**Purpose**: Deep-dive into individual student's learning activity.

**Capabilities**:
- **Activity Heatmap**: GitHub-style 12-month activity grid
- **Activity Timeline**: Chronological events (login, module completion, submission, grade received)
- **Submission History**: List with module name, status (Pending/Approved/Needs Revision)
- Navigate to evaluation workspace from pending submissions

#### 4.3.4 Evaluation Queue
**Purpose**: Prioritized list of submissions awaiting review.

**Capabilities**:
- Ordered by submission date (oldest first)
- Shows: module/assignment title, student name, submitted date, waiting days
- Click to open evaluation workspace
- Waiting days indicator for SLA visibility

#### 4.3.5 Evaluation Workspace
**Purpose**: Side-by-side grading interface.

**Capabilities**:
- **Left Panel**: Submission viewer (inline PDF/form preview)
- **Right Panel**: 
  - Grade slider (0–100)
  - Qualitative feedback textarea
  - Decision buttons: "Approve" or "Needs Revision"
- Submit evaluation → updates submission record + notifies student

---

### 4.4 Student Portal

#### 4.4.1 Dashboard
**Purpose**: Personalized learning home with motivational metrics.

**Capabilities**:
- **Greeting**: Time-based greeting with student's first name
- **Learning Streak**: Consecutive days of activity (fire icon)
- **Pending Assignments**: Due today / tomorrow / overdue with links
- **Continue Learning**: Course cards with progress % and resume button
- **Recent Scores**: Latest graded submissions with score
- **Activity Heatmap**: 364-day GitHub-style grid showing daily activity intensity

**Streak Calculation**:
- Counts consecutive days with at least one activity event
- LOGIN event auto-logged on first visit each day
- Broken if a day is missed

#### 4.4.2 My Courses
**Purpose**: Course content consumption and lesson progression.

**Capabilities**:
- **Course Sidebar**: Hierarchical tree (Course → Module → Lesson) with completion dots
- **Lesson Types**: Video, Reading (PDF), Quiz, Assignment/Lab
- **Video Player**: HTML5 player with controls
- **PDF/Slides Viewer**: Inline iframe with download button
- **iSpring Viewer**: Fullscreen SCORM content (same viewer as trainer but read-only)
- **Mark Complete**: Button to record lesson completion
- **Bookmarks**: Save/unsave lessons for quick access
- **Discussion**: Per-lesson Q&A thread (post questions, view replies)
- **Offline Download**: Download content for offline access (per-lesson)
- **Progress Tracking**: Auto-calculated based on completed lessons / total lessons

**Offline Content Strategy**:
| Content Type | Storage Method | Max Size |
|---|---|---|
| PDF/Documents | IndexedDB (Blob) | ≤50MB |
| Video | Cache API | Unlimited |
| SCORM/PPT | Cache API (manifest-based multi-file) | Unlimited |

#### 4.4.3 Assignments
**Purpose**: View, submit, and track graded coursework.

**Capabilities**:
- **Assignment List**: Grouped by status (Overdue → Pending → Completed)
- **Assignment Detail View**:
  - Instructions text
  - Key areas/objectives list
  - Reference files with preview/download
  - Note box (student's working notes)
  - Submission upload area (drag & drop / file picker)
- **Submission Upload**: Upload PDF/DOCX, stored in Supabase Storage
- **Graded View**: Shows submitted file, instructor feedback, and grade
- **Offline Cache**: Assignments cached in localStorage for offline access
- **File Preview**: Inline viewer for reference files and submissions

---

## 5. Offline / PWA Capabilities

### 5.1 Service Worker
- Registered via `vite-plugin-pwa`
- Caches static assets for offline app shell
- Custom `sw-offline.js` for dynamic content interception

### 5.2 Content Offline Storage
- **IndexedDB** (`offlineVault.ts`): Small files (PDFs, documents ≤50MB) stored as blobs
- **Cache API** (`offlineDownloader.ts`): Large files (videos, SCORM packages) stored as URL→Response pairs
- **Manifest-based SCORM**: Downloads all files listed in `manifest.json` generated during upload
- **Storage Estimation**: Monitors available storage, warns users when low

### 5.3 Offline UX
- Detects `navigator.onLine` changes via event listeners
- Shows persistent orange "Offline Mode" banner
- Restricts navigation to current portal
- Falls back to cached data (localStorage, IndexedDB)
- Graceful degradation: non-critical features hidden, core content accessible

### 5.4 Security
- Offline vault completely wiped on sign-out (`clearOfflineVault()`)
- Session cached in localStorage only for offline re-entry
- No sensitive data (passwords, tokens) persisted client-side beyond Supabase session

---

## 6. Database Architecture

### 6.1 Schema Overview (30+ tables)

**Core Entities**:
- `profiles` → User identity with role, name, avatar, active status
- `courses` → Top-level curriculum container
- `subjects` → Organized topics within a course
- `modules` → Individual learning units (with format + status)
- `module_versions` → Version-controlled content files
- `lessons` → Sub-units within modules
- `lesson_assets` → Files/media attached to lessons

**Enrollment & Access**:
- `cohorts` → Student groupings for course access
- `cohort_courses` → Courses available to cohort
- `cohort_modules` → Modules available to cohort (with `unlock_at`)
- `cohort_students` → Student enrollment in cohorts

**Evaluation**:
- `assignments` → Graded work definitions
- `assignment_cohorts` → Which cohorts receive assignment
- `assignment_files` → Reference files attached to assignment
- `submissions` → Student work + grade + feedback

**Mentoring**:
- `mentorships` → Mentor↔Student assignment (unique per student)
- `student_progress` → Progress % + status per student/cohort
- `mentor_settings` → Capacity + current load

**Communication**:
- `broadcasts` → Announcements
- `broadcast_audiences` → Targeting rules
- `broadcast_acks` → Acknowledgement records

**Tracking**:
- `activity_events` → All user activity (login, completion, submission…)
- `notifications` → In-app notification queue
- `learning_streaks` → Consecutive activity day tracking
- `lesson_completions` → Per-lesson completion records

**Trainer**:
- `module_trainers` → Module↔Trainer assignment
- `trainer_kits` → Course-level resource bundles for trainers
- `kit_resources` → Individual resources in a kit
- `kit_resource_versions` → Versioned kit files

### 6.2 Key Triggers
1. `fn_enforce_single_current_version` — Ensures only one module version is marked current
2. `fn_sync_mentor_load` — Updates `mentor_settings.current_load` on mentorship changes
3. `fn_generate_broadcast_acks` — Creates acknowledgement records for all targeted recipients
4. `fn_update_student_progress` — Recalculates progress % on lesson completion
5. `fn_flag_stalling_students` — Flags students inactive for 7+ days
6. `fn_notify_on_grade` — Creates notification when submission is graded
7. `fn_update_streak` — Maintains learning streak on activity
8. `fn_set_updated_at` — Auto-updates `updated_at` timestamps
9. `fn_handle_new_user` — Creates profile record on auth user creation

---

## 7. Integrations

### 7.1 Supabase
| Service | Usage |
|---------|-------|
| Auth | Email/password authentication, session management |
| Database | PostgreSQL with RLS for all CRUD operations |
| Storage | File uploads (submissions, assignments, module content) |
| Edge Functions | `r2-presign` (single file upload), `r2-multipart` (chunked large uploads) |
| Realtime | Infrastructure available (not actively used in current version) |

### 7.2 Cloudflare R2
- Stores SCORM/iSpring packages (multi-file folder structures)
- Stores large video files
- Accessed via presigned URLs generated by Edge Functions
- Public read URL configured via `VITE_R2_PUBLIC_URL`

### 7.3 iSpring
- SCORM packages exported from iSpring Suite
- Uploaded as folder structure (index.html + assets)
- Customizations injected at upload time:
  - Watermark/promo link removal
  - Double-click navigation fix
  - Arrow key video conflict resolution
  - Fullscreen resize handling
  - MutationObserver for dynamically injected elements

---

## 8. Upload Architecture

### 8.1 Standard File Upload
- Direct to Supabase Storage via client SDK
- Used for: assignment files, submissions, profile avatars, documents

### 8.2 SCORM/iSpring Upload (`ISpringUploader`)
- Folder-based upload via `webkitdirectory` input
- Files uploaded to R2 via presigned URLs (Edge Function)
- Max 3 concurrent uploads with retry logic (3 attempts)
- `index.html` is patched inline before upload (watermark removal)
- `manifest.json` generated and uploaded for offline support
- Progress tracked per-file and per-byte

### 8.3 Large File Multipart Upload (`MultipartUploader`)
- For files > 20MB
- S3-compatible multipart protocol via Edge Functions:
  1. `START` — Initialize multipart upload
  2. `SIGN_BATCH` — Get presigned URLs for all parts
  3. Upload parts in parallel (pool of 3)
  4. `COMPLETE` — Finalize upload
  5. `ABORT` — Cleanup on error/cancel
- Supports abort/cancel mid-upload

---

## 9. UI/UX Design System

### 9.1 Design Tokens
| Token | Value |
|-------|-------|
| Primary Blue | `#4493BF` |
| Navy (Dark) | `#0D2543` |
| Surface | `#F2F4F7` |
| Border Light | `rgba(13,37,67,0.08)` |
| Border Strong | `rgba(13,37,67,0.16)` |
| Font Family | Inter |
| Border Radius | Rounded (8-28px depending on element) |

### 9.2 Component Library
- Based on **shadcn/ui** (Radix Primitives + Tailwind)
- Full set: Dialog, Dropdown, Tabs, Select, Tooltip, Progress, Slider, Switch, etc.
- Custom components: `ISpringViewer`, `OfflineDownloadButton`, `StorageWarning`, `ProfileEditor`, `LoadingSkeleton`
- Toast notifications via **Sonner**
- Charts via **Recharts**

### 9.3 Navigation Patterns
- **Admin**: Centered pill-tab navigation bar (frosted glass effect)
- **Trainer**: Top navigation with unread badge
- **Mentor**: Tab navigation with screen-based routing
- **Student**: Compact top bar with 3 tabs (Dashboard, Courses, Assignments)

### 9.4 Responsive Design
- Desktop-first with full responsive layouts
- Flexbox/Grid-based layouts throughout
- No fixed breakpoints (fluid design)
- Overflow handling for long content lists

---

## 10. Security Considerations

### 10.1 Data Access
- All database access governed by RLS policies
- No direct database exposure — all through Supabase client with `anon` key
- Admin operations use service role only via Edge Functions
- User creation uses secondary admin client to avoid session hijacking

### 10.2 Content Protection
- SCORM content served via same-origin proxy (`/scorm-proxy/`)
- Presigned URLs are time-limited (generated on-demand)
- R2 content not publicly listable

### 10.3 Authentication Security
- Supabase Auth handles password hashing (bcrypt)
- Forced password reset for admin-created accounts
- Session tokens managed by Supabase (HTTP-only cookies not applicable for SPA)

### 10.4 Offline Security
- All offline cached content wiped on sign-out
- No sensitive credentials stored beyond session token
- Storage warning when device storage is low

---

## 11. Performance Considerations

### 11.1 Frontend
- Vite for fast HMR and optimized production builds
- Code splitting by route/portal
- Lazy loading for heavy components (charts, viewers)
- Optimistic UI updates (broadcast acknowledge, etc.)

### 11.2 Data Loading
- Parallel data fetching via `Promise.all` on page load
- Materialized views for analytics (avoid expensive real-time queries)
- Pagination not yet implemented (planned for large datasets)

### 11.3 Upload Performance
- Concurrent upload workers (3 parallel) for SCORM packages
- Chunked multipart upload for large files (20MB chunks)
- Retry with exponential backoff on failure

---

## 12. Future Roadmap (Planned Features)

Based on codebase analysis, these features are referenced but not yet fully implemented:

1. **Quiz Engine** — Module format `QUIZ` exists but no quiz creation/delivery UI
2. **Supabase Realtime** — Infrastructure supports real-time subscriptions (not active)
3. **Forgot Password** — Route exists but shows placeholder
4. **Pagination** — Large data lists need cursor/offset pagination
5. **Push Notifications** — PWA notification permission + service worker push
6. **Advanced Reporting** — Export analytics to CSV/PDF
7. **Course Certificates** — Certificate generation on course completion
8. **Cohort Content Scheduling** — `unlock_at` field exists but no UI for scheduling
9. **Student Notifications Panel** — Referenced in database architecture but minimal UI
10. **Search Across Portals** — Global search functionality

---

## 13. Environment Configuration

### 13.1 Required Environment Variables
| Variable | Purpose |
|----------|---------|
| `VITE_SUPABASE_URL` | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Supabase anonymous/public key |
| `VITE_R2_PUBLIC_URL` | Cloudflare R2 public bucket URL |

### 13.2 Supabase Edge Functions
| Function | Purpose |
|----------|---------|
| `r2-presign` | Generate presigned PUT URL for single file upload to R2 |
| `r2-multipart` | Manage multipart upload lifecycle (START, SIGN_BATCH, COMPLETE, ABORT) |

---

## 14. Deployment & Infrastructure

### 14.1 Frontend Deployment
- Static SPA built with `vite build`
- Deployable to any static host (Cloudflare Pages, Vercel, Netlify)
- Service worker registered for offline support

### 14.2 Backend (Supabase)
- Managed PostgreSQL database
- Auth service (email/password)
- Storage buckets for file management
- Edge Functions (Deno runtime) for R2 operations

### 14.3 Content Delivery
- Cloudflare R2 for large content (SCORM, videos)
- Supabase Storage for smaller files (submissions, documents)
- Same-origin proxy for SCORM iframe serving

---

## 15. Glossary

| Term | Definition |
|------|-----------|
| **Cohort** | A group of students enrolled together with shared course/module access |
| **Module** | A single unit of learning content (video, PDF, SCORM package, etc.) |
| **Subject** | A grouping of related modules within a course |
| **SCORM** | Sharable Content Object Reference Model — e-learning standard |
| **iSpring** | Authoring tool that exports SCORM-compatible content packages |
| **Kit** | A collection of teaching resources assigned to a trainer for a specific course |
| **Broadcast** | An organization-wide announcement requiring acknowledgement |
| **Streak** | Consecutive days a student has been active on the platform |
| **Stalling** | A student status indicating 7+ days of inactivity |
| **RLS** | Row Level Security — PostgreSQL feature restricting data access per user |
| **R2** | Cloudflare's S3-compatible object storage service |

---

*Document generated from codebase analysis — SafetyCatch LMS v0.0.1*  
*Last updated: June 2026*
