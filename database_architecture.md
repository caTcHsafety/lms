# SafetyCatch — Complete Database Architecture
## PostgreSQL via Supabase · Full Design Spec

---

## 0. What the UI Tells Us (Screen-by-Screen Audit)

| Screen | Role | Key Data Points Observed |
|--------|------|--------------------------|
| Content Vault — Module Detail | Admin | module has `course`, `subject`, `module_code`, `format`, `status` (Published/Draft), `duration_min`, `assigned_trainers[]`, version history (`v1/v2/v3`, note, author, date) |
| Create New Module modal | Admin | module belongs to `existing subject` OR `new subject` OR `new course`; fields: course, subject/folder, name, format (VIDEO/PPT/PDF/SCORM/LINK/QUIZ) |
| New Revision modal | Admin | upload file, revision notes free text, publishes new version atomically |
| Cohort Access — Cohort Detail | Admin | cohort has name, student count, module count, created_at; assigned modules show course·subject, type badge, status, last updated; cohort uploads section (cohort-private files) |
| Create Cohort wizard (4 steps) | Admin | Step 1: cohort name students_enrolled count; Step 2: select courses (multi-select, shows code + subject count); Steps 3–4 implied (select subjects/modules, confirm) |
| Manage Cohort Content modal | Admin | same course multi-select; bottom bar shows running total of modules·subjects·courses |
| User Mgmt — Mentors & Students | Admin | unassigned students queue (12 pending); mentor list with capacity bar (e.g. 3/20, 25/25 = AT CAPACITY shown red); student row has name, email, cohort tags (multi-cohort), status (Unassigned/Pending), enrolled date |
| Add Mentor modal | Admin | name, email, capacity (int, default 15) |
| Add Student modal | Admin | name, learner_id/email, cohorts (multi-select checkboxes) |
| User Mgmt — Trainers | Admin | trainer list with content count badge; trainer detail shows assigned content (VIDEO/SOP tags), course name; add trainer: name + email only |
| Assignments | Admin | assignment has title, description, due_date, cohorts[], attached_files[]; student list per cohort |
| New Assignment modal | Admin | title, description, due_date, cohorts (multi-select), attach files |
| News Publisher | Admin | stats: announcements_sent, pending_acks, fully_read; announcement has title, priority (CRITICAL/INFO/STANDARD), audience group, sent_at; detail shows recipients, acknowledged count, outstanding count, read receipt %, compliance audit log per recipient |
| Compose Announcement modal | Admin | title, audience (dropdown), priority (Info/Standard/Critical), message body; recipients must acknowledge to clear |
| System Analytics | Admin | KPIs: outstanding_submissions, active_teaching_staff, broadcast_compliance%, total_pending_reviews; Assignment Throughput chart (submitted vs graded per week, 10 weeks); Pending Grading Queue per mentor (count + oldest waiting days); Engagement Matrix (staff: logins, sessions, last_seen) |
| Trainer Dashboard | Trainer | broadcast feed with CRITICAL/UNREAD badges, acknowledge button; quick-launch deck cards (code, title, duration, slides, version badge) |
| Trainer Content Vault | Trainer | kit cards: slide decks (version picker, note, launch/download), videos, documents tabs; assigned by admin |
| Student Dashboard | Student | learning streak (days), assignments_to_finish (due today / tomorrow), continue_learning cards with progress %, recent_scores, learning_activity heatmap (full year) |
| Student My Courses — Lesson | Student | course sidebar with modules and lessons (type icon, duration, completion dot); lesson viewer: video tab + lecture slides tab (canvas renderer, slide count, download button); mark complete button |
| Student Assignments — Incomplete | Student | overdue badge, module context, due date, points; instructions, key areas list, note box, submission upload area |
| Student Assignments — Graded | Student | submitted file shown, instructor feedback text, grade display |
| Student Notifications panel | Student | overdue alert, grade notification, new lecture available |
| Student Profile popup | Student | name, role title, assigned mentor (name, email, phone), sign out |
| Mentor Dashboard | Mentor | pending_evaluations count, cohort_size, avg_progress%, stalling count; broadcasts requiring ack; cohort health (overall completion %, on_track/stalling counts); flagged_stalling list (name, %, last_active) |
| Mentor Cohort Roster | Mentor | per-student: progress bar %, last_active relative, status badge (On track / Stalling / Awaiting evaluation) |
| Mentor Student Detail | Mentor | activity graph (GitHub-style heatmap, 12mo); activity timeline (login, module completion, submission events); submission history (module name, status: Pending/Approved) |
| Mentor Evaluation Queue | Mentor | ordered by submission date; per item: module·assignment title, student name, submitted_at, waiting_days |
| Mentor Evaluation Desk | Mentor | left: submission viewer (Google Form / PDF inline); right: grade (0–100 slider), qualitative feedback textarea, final decision (Needs Revision / Approve) |

---

## 1. Additional Tables Included

1. `cohorts` — the cohort entity itself
2. `cohort_modules` — which module versions are assigned to which cohort
3. `cohort_students` — many-to-many between cohorts and students
4. `cohort_uploads` — cohort-private files
5. `module_versions` — the versioned file uploads
6. `trainer_kits` — the trainer "kit" grouping
7. `broadcast_audiences` — audience targeting groups for News Publisher
8. `learning_streaks` — student streak tracking
9. `lesson_completions` — per-student lesson completion records
10. `notifications` — in-app notifications
11. `student_profiles_ext` — (Integrated into `profiles`)

---

## 2. Revised Custom Enums

```sql
-- Roles
CREATE TYPE user_role AS ENUM ('admin', 'trainer', 'mentor', 'student');

-- Module/content formats
CREATE TYPE module_format AS ENUM ('video', 'ppt', 'pdf', 'scorm', 'link', 'quiz');

-- Content publish status
CREATE TYPE publish_status AS ENUM ('draft', 'published', 'archived');

-- Submission evaluation status
CREATE TYPE eval_status AS ENUM ('pending', 'approved', 'needs_revision');

-- Student learning status
CREATE TYPE student_status AS ENUM ('on_track', 'stalling', 'awaiting_eval');

-- Announcement priority
CREATE TYPE broadcast_priority AS ENUM ('info', 'standard', 'critical');

-- Broadcast audience scope
CREATE TYPE audience_type AS ENUM ('all_staff', 'trainers', 'mentors', 'cohort_trainers', 'cohort_mentors', 'custom');

-- Activity event kinds
CREATE TYPE activity_kind AS ENUM ('login', 'lesson_complete', 'module_complete', 'submission', 'grade_received', 'broadcast_ack', 'inactivity_flag');

-- Notification types
CREATE TYPE notification_type AS ENUM ('assignment_overdue', 'assignment_graded', 'new_lesson', 'broadcast', 'mentor_message');

-- Trainer resource types
CREATE TYPE kit_resource_type AS ENUM ('deck', 'video', 'document');

-- Document format
CREATE TYPE document_format AS ENUM ('pdf', 'docx', 'xlsx', 'pptx', 'google_form', 'zip', 'scorm', 'mp4', 'link');
```

---

## 3. Complete Schema

### 3.1 PROFILES & USERS

```sql
CREATE TABLE public.profiles (
    id              UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    role            user_role NOT NULL DEFAULT 'student',
    first_name      TEXT NOT NULL,
    last_name       TEXT NOT NULL,
    initials        TEXT GENERATED ALWAYS AS (
                        upper(left(first_name,1)) || upper(left(last_name,1))
                    ) STORED,
    avatar_url      TEXT,
    phone           TEXT,
    title           TEXT,
    temp_password   TEXT,
    must_reset_pw   BOOLEAN NOT NULL DEFAULT TRUE,
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    last_active_at  TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE public.mentor_settings (
    mentor_id       UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
    capacity        INT NOT NULL DEFAULT 15,
    current_load    INT NOT NULL DEFAULT 0,
    status          TEXT GENERATED ALWAYS AS (
                        CASE WHEN current_load >= capacity THEN 'at_capacity' ELSE 'active' END
                    ) STORED
);
```

### 3.2 COURSES, SUBJECTS, MODULES

```sql
CREATE TABLE public.courses (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code        TEXT NOT NULL UNIQUE,
    title       TEXT NOT NULL,
    summary     TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE public.subjects (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    course_id   UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
    title       TEXT NOT NULL,
    position    INT NOT NULL DEFAULT 0,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(course_id, title)
);

CREATE TABLE public.modules (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    subject_id      UUID NOT NULL REFERENCES public.subjects(id) ON DELETE CASCADE,
    code            TEXT NOT NULL UNIQUE,
    title           TEXT NOT NULL,
    format          module_format NOT NULL,
    status          publish_status NOT NULL DEFAULT 'draft',
    duration_min    INT,
    position        INT NOT NULL DEFAULT 0,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE public.module_versions (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    module_id       UUID NOT NULL REFERENCES public.modules(id) ON DELETE CASCADE,
    version_label   TEXT NOT NULL,
    version_number  INT NOT NULL,
    note            TEXT,
    file_url        TEXT,
    file_name       TEXT,
    file_size_bytes BIGINT,
    format          document_format,
    is_current      BOOLEAN NOT NULL DEFAULT FALSE,
    uploaded_by     UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(module_id, version_number)
);

CREATE TABLE public.module_trainers (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    module_id   UUID NOT NULL REFERENCES public.modules(id) ON DELETE CASCADE,
    trainer_id  UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    assigned_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(module_id, trainer_id)
);
```

### 3.3 LESSONS

```sql
CREATE TABLE public.lessons (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    module_id       UUID NOT NULL REFERENCES public.modules(id) ON DELETE CASCADE,
    title           TEXT NOT NULL,
    description     TEXT,
    kind            module_format NOT NULL,
    duration_min    INT,
    position        INT NOT NULL DEFAULT 0,
    is_published    BOOLEAN NOT NULL DEFAULT FALSE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE public.lesson_assets (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lesson_id       UUID NOT NULL REFERENCES public.lessons(id) ON DELETE CASCADE,
    label           TEXT NOT NULL,
    asset_type      TEXT NOT NULL,
    file_url        TEXT,
    slide_count     INT,
    duration_min    INT,
    is_downloadable BOOLEAN NOT NULL DEFAULT FALSE,
    position        INT NOT NULL DEFAULT 0,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE public.lesson_completions (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lesson_id       UUID NOT NULL REFERENCES public.lessons(id) ON DELETE CASCADE,
    student_id      UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    completed_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(lesson_id, student_id)
);
```

### 3.4 COHORTS

```sql
CREATE TABLE public.cohorts (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name            TEXT NOT NULL,
    created_by      UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE public.cohort_courses (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cohort_id   UUID NOT NULL REFERENCES public.cohorts(id) ON DELETE CASCADE,
    course_id   UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
    UNIQUE(cohort_id, course_id)
);

CREATE TABLE public.cohort_modules (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cohort_id           UUID NOT NULL REFERENCES public.cohorts(id) ON DELETE CASCADE,
    module_id           UUID NOT NULL REFERENCES public.modules(id) ON DELETE CASCADE,
    module_version_id   UUID REFERENCES public.module_versions(id) ON DELETE SET NULL,
    unlock_at           TIMESTAMPTZ,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(cohort_id, module_id)
);

CREATE TABLE public.cohort_students (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cohort_id       UUID NOT NULL REFERENCES public.cohorts(id) ON DELETE CASCADE,
    student_id      UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    enrolled_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(cohort_id, student_id)
);

CREATE TABLE public.cohort_uploads (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cohort_id       UUID NOT NULL REFERENCES public.cohorts(id) ON DELETE CASCADE,
    uploaded_by     UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    file_name       TEXT NOT NULL,
    file_url        TEXT NOT NULL,
    file_size_bytes BIGINT,
    format          document_format,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### 3.5 MENTORSHIPS & STUDENT STATUS

```sql
CREATE TABLE public.mentorships (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    mentor_id       UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    student_id      UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    assigned_by     UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    assigned_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(student_id)
);

CREATE TABLE public.student_progress (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id      UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    cohort_id       UUID NOT NULL REFERENCES public.cohorts(id) ON DELETE CASCADE,
    progress_pct    INT NOT NULL DEFAULT 0,
    status          student_status NOT NULL DEFAULT 'on_track',
    last_active_at  TIMESTAMPTZ,
    stall_flagged_at TIMESTAMPTZ,
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(student_id, cohort_id)
);
```

### 3.6 TRAINER KITS

```sql
CREATE TABLE public.trainer_kits (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    trainer_id      UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    course_id       UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
    assigned_by     UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    assigned_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(trainer_id, course_id)
);

CREATE TABLE public.kit_resources (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    kit_id              UUID NOT NULL REFERENCES public.trainer_kits(id) ON DELETE CASCADE,
    resource_type       kit_resource_type NOT NULL,
    title               TEXT NOT NULL,
    module_code         TEXT,
    duration_min        INT,
    slide_count         INT,
    pages               INT,
    size_mb             NUMERIC(6,2),
    description         TEXT,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE public.kit_resource_versions (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    resource_id     UUID NOT NULL REFERENCES public.kit_resources(id) ON DELETE CASCADE,
    version_label   TEXT NOT NULL,
    version_number  INT NOT NULL,
    note            TEXT,
    file_url        TEXT,
    is_current      BOOLEAN NOT NULL DEFAULT FALSE,
    created_by      UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(resource_id, version_number)
);
```

### 3.7 ASSIGNMENTS

```sql
CREATE TABLE public.assignments (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title           TEXT NOT NULL,
    description     TEXT,
    instructions    TEXT[],
    note            TEXT,
    points          INT NOT NULL DEFAULT 100,
    due_at          TIMESTAMPTZ,
    status          publish_status NOT NULL DEFAULT 'draft',
    created_by      UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE public.assignment_cohorts (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    assignment_id   UUID NOT NULL REFERENCES public.assignments(id) ON DELETE CASCADE,
    cohort_id       UUID NOT NULL REFERENCES public.cohorts(id) ON DELETE CASCADE,
    UNIQUE(assignment_id, cohort_id)
);

CREATE TABLE public.assignment_files (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    assignment_id   UUID NOT NULL REFERENCES public.assignments(id) ON DELETE CASCADE,
    file_name       TEXT NOT NULL,
    file_url        TEXT NOT NULL,
    file_size_bytes BIGINT,
    format          document_format,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE public.submissions (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    assignment_id   UUID NOT NULL REFERENCES public.assignments(id) ON DELETE CASCADE,
    student_id      UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    evaluated_by    UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    status          eval_status NOT NULL DEFAULT 'pending',
    file_name       TEXT,
    file_url        TEXT,
    file_size_bytes BIGINT,
    format          document_format,
    submitted_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    graded_at       TIMESTAMPTZ,
    grade           INT,
    feedback        TEXT,
    waiting_days    INT GENERATED ALWAYS AS (
                        EXTRACT(DAY FROM NOW() - submitted_at)::INT
                    ) STORED,
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(assignment_id, student_id)
);
```

### 3.8 BROADCASTS

```sql
CREATE TABLE public.broadcast_audiences (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    label       TEXT NOT NULL,
    type        audience_type NOT NULL,
    cohort_id   UUID REFERENCES public.cohorts(id) ON DELETE CASCADE,
    module_id   UUID REFERENCES public.modules(id) ON DELETE CASCADE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE public.broadcasts (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    author_id       UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    audience_id     UUID REFERENCES public.broadcast_audiences(id) ON DELETE SET NULL,
    title           TEXT NOT NULL,
    body            TEXT NOT NULL,
    priority        broadcast_priority NOT NULL DEFAULT 'standard',
    sent_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE public.broadcast_acks (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    broadcast_id    UUID NOT NULL REFERENCES public.broadcasts(id) ON DELETE CASCADE,
    user_id         UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    acked_at        TIMESTAMPTZ,
    UNIQUE(broadcast_id, user_id)
);
```

### 3.9 ACTIVITY EVENTS

```sql
CREATE TABLE public.activity_events (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    kind        activity_kind NOT NULL,
    label       TEXT NOT NULL,
    detail      TEXT,
    ref_id      UUID,
    ref_table   TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_activity_user_date ON public.activity_events(user_id, created_at DESC);
```

### 3.10 NOTIFICATIONS

```sql
CREATE TABLE public.notifications (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    type            notification_type NOT NULL,
    title           TEXT NOT NULL,
    body            TEXT,
    ref_id          UUID,
    ref_table       TEXT,
    is_read         BOOLEAN NOT NULL DEFAULT FALSE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_notifications_user_unread ON public.notifications(user_id, is_read) 
WHERE is_read = FALSE;
```

### 3.11 LEARNING STREAKS

```sql
CREATE TABLE public.learning_streaks (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id      UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    streak_days     INT NOT NULL DEFAULT 0,
    last_activity_date DATE,
    longest_streak  INT NOT NULL DEFAULT 0,
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(student_id)
);
```

### 3.12 SYSTEM ANALYTICS SUPPORT VIEWS

```sql
CREATE MATERIALIZED VIEW public.mv_weekly_throughput AS
SELECT
    date_trunc('week', submitted_at)::DATE AS week_start,
    COUNT(*) FILTER (WHERE status IN ('pending','approved','needs_revision')) AS submitted,
    COUNT(*) FILTER (WHERE status IN ('approved','needs_revision') AND graded_at IS NOT NULL) AS graded
FROM public.submissions
GROUP BY 1
ORDER BY 1;

CREATE VIEW public.vw_mentor_queue AS
SELECT
    m.mentor_id,
    p.first_name || ' ' || p.last_name AS mentor_name,
    COUNT(s.id) AS pending_count,
    MAX(s.waiting_days) AS oldest_days
FROM public.mentorships m
JOIN public.profiles p ON p.id = m.mentor_id
JOIN public.submissions s ON s.student_id = m.student_id AND s.status = 'pending'
GROUP BY m.mentor_id, mentor_name;

CREATE VIEW public.vw_staff_engagement AS
SELECT
    p.id,
    p.first_name || ' ' || p.last_name AS name,
    p.role,
    COUNT(ae.id) FILTER (WHERE ae.kind = 'login') AS login_count,
    COUNT(DISTINCT DATE(ae.created_at)) AS session_days,
    MAX(ae.created_at) AS last_seen
FROM public.profiles p
LEFT JOIN public.activity_events ae ON ae.user_id = p.id
WHERE p.role IN ('trainer', 'mentor')
GROUP BY p.id, name, p.role;
```

---

## 4. All Triggers

*(Triggers remain the same as specified in the original provided spec: 1. `fn_enforce_single_current_version`, 2. `fn_sync_mentor_load`, 3. `fn_generate_broadcast_acks`, 4. `fn_update_student_progress`, 5. `fn_flag_stalling_students`, 6. `fn_notify_on_grade`, 7. `fn_update_streak`, 8. `fn_set_updated_at`, 9. `fn_handle_new_user`)*

---

## 5. Row Level Security Policies

```sql
-- Enable RLS on every table
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mentor_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.modules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.module_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.module_trainers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lessons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lesson_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lesson_completions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cohorts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cohort_courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cohort_modules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cohort_students ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cohort_uploads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mentorships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trainer_kits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kit_resources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kit_resource_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assignment_cohorts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assignment_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.broadcasts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.broadcast_audiences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.broadcast_acks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.learning_streaks ENABLE ROW LEVEL SECURITY;

-- Helper: get current user's role
CREATE OR REPLACE FUNCTION auth.user_role()
RETURNS user_role LANGUAGE sql SECURITY DEFINER AS $$
    SELECT role FROM public.profiles WHERE id = auth.uid();
$$;

-- Helper: is current user an admin?
CREATE OR REPLACE FUNCTION auth.is_admin()
RETURNS BOOLEAN LANGUAGE sql SECURITY DEFINER AS $$
    SELECT EXISTS(SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin');
$$;

-- ── PROFILES ──────────────────────────────────────────────
CREATE POLICY "profiles_select_all" ON public.profiles FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "profiles_update_self" ON public.profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "profiles_admin_all" ON public.profiles FOR ALL USING (auth.is_admin());

-- ── COURSES / SUBJECTS / MODULES / LESSONS ─────────────────
CREATE POLICY "curriculum_select" ON public.courses FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "curriculum_select" ON public.subjects FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "curriculum_select" ON public.modules FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "curriculum_select" ON public.lessons FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "curriculum_select" ON public.lesson_assets FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "curriculum_admin" ON public.courses FOR ALL USING (auth.is_admin());
CREATE POLICY "curriculum_admin" ON public.subjects FOR ALL USING (auth.is_admin());
CREATE POLICY "curriculum_admin" ON public.modules FOR ALL USING (auth.is_admin());
CREATE POLICY "curriculum_admin" ON public.lessons FOR ALL USING (auth.is_admin());
CREATE POLICY "curriculum_admin" ON public.lesson_assets FOR ALL USING (auth.is_admin());

CREATE POLICY "mv_read_current" ON public.module_versions FOR SELECT USING (is_current = TRUE OR auth.is_admin());
CREATE POLICY "mv_admin" ON public.module_versions FOR ALL USING (auth.is_admin());

-- ── COHORTS ────────────────────────────────────────────────
CREATE POLICY "cohorts_admin" ON public.cohorts FOR ALL USING (auth.is_admin());
CREATE POLICY "cohorts_read_members" ON public.cohorts FOR SELECT USING (
    auth.is_admin() OR EXISTS (
        SELECT 1 FROM public.cohort_students cs WHERE cs.cohort_id = id AND cs.student_id = auth.uid()
    ) OR EXISTS (
        SELECT 1 FROM public.mentorships ms
        JOIN public.cohort_students cs ON cs.student_id = ms.student_id
        WHERE ms.mentor_id = auth.uid() AND cs.cohort_id = id
    )
);

CREATE POLICY "cohort_courses_admin" ON public.cohort_courses FOR ALL USING (auth.is_admin());
CREATE POLICY "cohort_modules_admin" ON public.cohort_modules FOR ALL USING (auth.is_admin());
CREATE POLICY "cohort_modules_student" ON public.cohort_modules FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM public.cohort_students cs
        WHERE cs.cohort_id = cohort_id
          AND cs.student_id = auth.uid()
          AND (unlock_at IS NULL OR unlock_at <= NOW())
    )
);

CREATE POLICY "cohort_students_admin" ON public.cohort_students FOR ALL USING (auth.is_admin());
CREATE POLICY "cohort_students_self" ON public.cohort_students FOR SELECT USING (student_id = auth.uid());
CREATE POLICY "cohort_students_mentor" ON public.cohort_students FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.mentorships ms WHERE ms.mentor_id = auth.uid() AND ms.student_id = student_id)
);

-- ── MENTORSHIPS & STUDENT PROGRESS ────────────────────────
CREATE POLICY "mentorships_admin" ON public.mentorships FOR ALL USING (auth.is_admin());
CREATE POLICY "mentorships_self_mentor" ON public.mentorships FOR SELECT USING (mentor_id = auth.uid() OR student_id = auth.uid());
CREATE POLICY "student_progress_admin" ON public.student_progress FOR ALL USING (auth.is_admin());
CREATE POLICY "student_progress_self" ON public.student_progress FOR SELECT USING (student_id = auth.uid());
CREATE POLICY "student_progress_mentor" ON public.student_progress FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.mentorships ms WHERE ms.mentor_id = auth.uid() AND ms.student_id = student_id)
);

-- ── TRAINER KITS ───────────────────────────────────────────
CREATE POLICY "kits_admin" ON public.trainer_kits FOR ALL USING (auth.is_admin());
CREATE POLICY "kits_trainer_self" ON public.trainer_kits FOR SELECT USING (trainer_id = auth.uid());
CREATE POLICY "kit_resources_admin" ON public.kit_resources FOR ALL USING (auth.is_admin());
CREATE POLICY "kit_resources_trainer" ON public.kit_resources FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.trainer_kits tk WHERE tk.id = kit_id AND tk.trainer_id = auth.uid())
);
CREATE POLICY "kit_versions_admin" ON public.kit_resource_versions FOR ALL USING (auth.is_admin());
CREATE POLICY "kit_versions_trainer" ON public.kit_resource_versions FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM public.kit_resources kr
        JOIN public.trainer_kits tk ON tk.id = kr.kit_id
        WHERE kr.id = resource_id AND tk.trainer_id = auth.uid()
    )
);

-- ── ASSIGNMENTS & SUBMISSIONS ──────────────────────────────
CREATE POLICY "assignments_admin" ON public.assignments FOR ALL USING (auth.is_admin());
CREATE POLICY "assignments_read_enrolled" ON public.assignments FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM public.assignment_cohorts ac
        JOIN public.cohort_students cs ON cs.cohort_id = ac.cohort_id
        WHERE ac.assignment_id = id AND cs.student_id = auth.uid()
    )
);
CREATE POLICY "assignments_read_mentor" ON public.assignments FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM public.assignment_cohorts ac
        JOIN public.cohort_students cs ON cs.cohort_id = ac.cohort_id
        JOIN public.mentorships ms ON ms.student_id = cs.student_id
        WHERE ac.assignment_id = id AND ms.mentor_id = auth.uid()
    )
);

CREATE POLICY "submissions_admin" ON public.submissions FOR ALL USING (auth.is_admin());
CREATE POLICY "submissions_student_self" ON public.submissions FOR SELECT USING (student_id = auth.uid());
CREATE POLICY "submissions_student_insert" ON public.submissions FOR INSERT WITH CHECK (student_id = auth.uid());
CREATE POLICY "submissions_mentor_grade" ON public.submissions FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.mentorships ms WHERE ms.mentor_id = auth.uid() AND ms.student_id = student_id)
);
CREATE POLICY "submissions_mentor_update" ON public.submissions FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.mentorships ms WHERE ms.mentor_id = auth.uid() AND ms.student_id = student_id)
);

-- ── BROADCASTS ─────────────────────────────────────────────
CREATE POLICY "broadcasts_admin" ON public.broadcasts FOR ALL USING (auth.is_admin());
CREATE POLICY "broadcasts_read_recipient" ON public.broadcasts FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.broadcast_acks ba WHERE ba.broadcast_id = id AND ba.user_id = auth.uid())
);
CREATE POLICY "broadcast_acks_self" ON public.broadcast_acks FOR ALL USING (user_id = auth.uid());
CREATE POLICY "broadcast_acks_admin" ON public.broadcast_acks FOR ALL USING (auth.is_admin());

-- ── ACTIVITY EVENTS ──────────────────────────────────────────
CREATE POLICY "activity_events_self" ON public.activity_events FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "activity_events_insert_self" ON public.activity_events FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "activity_events_admin" ON public.activity_events FOR ALL USING (auth.is_admin());
CREATE POLICY "activity_events_mentor" ON public.activity_events FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.mentorships ms WHERE ms.mentor_id = auth.uid() AND ms.student_id = user_id)
);

-- ── NOTIFICATIONS ────────────────────────────────────────────
CREATE POLICY "notifications_self" ON public.notifications FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "notifications_update_self" ON public.notifications FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "notifications_admin" ON public.notifications FOR ALL USING (auth.is_admin());

-- ── LEARNING STREAKS ─────────────────────────────────────────
CREATE POLICY "learning_streaks_self" ON public.learning_streaks FOR SELECT USING (student_id = auth.uid());
CREATE POLICY "learning_streaks_admin" ON public.learning_streaks FOR ALL USING (auth.is_admin());
CREATE POLICY "learning_streaks_mentor" ON public.learning_streaks FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.mentorships ms WHERE ms.mentor_id = auth.uid() AND ms.student_id = public.learning_streaks.student_id)
);
```
