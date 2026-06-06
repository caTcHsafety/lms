-- Custom Types
CREATE TYPE user_role AS ENUM ('admin', 'trainer', 'mentor', 'student');
CREATE TYPE broadcast_priority AS ENUM ('low', 'normal', 'high', 'urgent');
CREATE TYPE submission_status AS ENUM ('pending', 'approved', 'needs_revision');

-- Profiles (Extends auth.users)
CREATE TABLE profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL UNIQUE,
    full_name TEXT NOT NULL,
    role user_role NOT NULL DEFAULT 'student',
    temp_password TEXT,
    must_reset_pw BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Mentor Settings (Capacity limits)
CREATE TABLE mentor_settings (
    mentor_id UUID PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
    max_capacity INTEGER NOT NULL DEFAULT 25,
    current_load INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Cohorts
CREATE TABLE cohorts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT,
    start_date DATE NOT NULL,
    end_date DATE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Mentorships (Mapping mentors to students)
CREATE TABLE mentorships (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    mentor_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    active BOOLEAN DEFAULT true,
    assigned_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(mentor_id, student_id)
);

-- Cohort Students (Mapping students to cohorts)
CREATE TABLE cohort_students (
    cohort_id UUID NOT NULL REFERENCES cohorts(id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    enrolled_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (cohort_id, student_id)
);

-- Courses & Modules
CREATE TABLE courses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    description TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE modules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    order_index INTEGER NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE module_versions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    module_id UUID NOT NULL REFERENCES modules(id) ON DELETE CASCADE,
    version_number INTEGER NOT NULL,
    content_url TEXT NOT NULL,
    slide_count INTEGER,
    is_published BOOLEAN DEFAULT false,
    published_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(module_id, version_number)
);

-- Cohort Modules (Drip feed)
CREATE TABLE cohort_modules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cohort_id UUID NOT NULL REFERENCES cohorts(id) ON DELETE CASCADE,
    module_id UUID NOT NULL REFERENCES modules(id) ON DELETE CASCADE,
    unlock_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(cohort_id, module_id)
);

-- Student Progress & Streaks
CREATE TABLE student_progress (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    module_id UUID NOT NULL REFERENCES modules(id) ON DELETE CASCADE,
    completed BOOLEAN DEFAULT false,
    stalled_flag BOOLEAN DEFAULT false,
    completed_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(student_id, module_id)
);

CREATE TABLE learning_streaks (
    student_id UUID PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
    current_streak INTEGER DEFAULT 0,
    longest_streak INTEGER DEFAULT 0,
    last_activity_date DATE,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Submissions (Homework)
CREATE TABLE submissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    module_id UUID NOT NULL REFERENCES modules(id) ON DELETE CASCADE,
    file_url TEXT NOT NULL,
    status submission_status DEFAULT 'pending',
    grade NUMERIC(5,2),
    feedback TEXT,
    submitted_at TIMESTAMPTZ DEFAULT NOW(),
    reviewed_at TIMESTAMPTZ,
    reviewed_by UUID REFERENCES profiles(id) ON DELETE SET NULL
);

-- Broadcasts (News Publisher / Compliance Inbox)
CREATE TABLE broadcasts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    priority broadcast_priority DEFAULT 'normal',
    published_by UUID NOT NULL REFERENCES profiles(id),
    published_at TIMESTAMPTZ DEFAULT NOW(),
    requires_ack BOOLEAN DEFAULT false
);

CREATE TABLE broadcast_audiences (
    broadcast_id UUID NOT NULL REFERENCES broadcasts(id) ON DELETE CASCADE,
    role_target user_role,
    cohort_target UUID REFERENCES cohorts(id) ON DELETE CASCADE,
    PRIMARY KEY (broadcast_id, role_target, cohort_target)
);

CREATE TABLE broadcast_acks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    broadcast_id UUID NOT NULL REFERENCES broadcasts(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    acked_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(broadcast_id, user_id)
);

-- Activity Events (Analytics & Heatmaps)
CREATE TABLE activity_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    event_type TEXT NOT NULL,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==========================================
-- RLS (Row Level Security) Policies
-- ==========================================

-- Enable RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE mentor_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE cohorts ENABLE ROW LEVEL SECURITY;
ALTER TABLE mentorships ENABLE ROW LEVEL SECURITY;
ALTER TABLE cohort_students ENABLE ROW LEVEL SECURITY;
ALTER TABLE courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE modules ENABLE ROW LEVEL SECURITY;
ALTER TABLE module_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE cohort_modules ENABLE ROW LEVEL SECURITY;
ALTER TABLE student_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE learning_streaks ENABLE ROW LEVEL SECURITY;
ALTER TABLE submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE broadcasts ENABLE ROW LEVEL SECURITY;
ALTER TABLE broadcast_audiences ENABLE ROW LEVEL SECURITY;
ALTER TABLE broadcast_acks ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_events ENABLE ROW LEVEL SECURITY;

-- Profiles: Admins can do anything. Users can read/update their own. Mentors can read their students.
CREATE POLICY "Admins have full access to profiles" ON profiles FOR ALL USING (auth.jwt() ->> 'role' = 'admin');
CREATE POLICY "Users can read own profile" ON profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Mentors can read assigned students" ON profiles FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM mentorships 
        WHERE mentor_id = auth.uid() AND student_id = profiles.id AND active = true
    )
);

-- Submissions: Students insert/read their own. Mentors read/update their assigned students'. Admins full access.
CREATE POLICY "Admins full access to submissions" ON submissions FOR ALL USING (auth.jwt() ->> 'role' = 'admin');
CREATE POLICY "Students can insert own submissions" ON submissions FOR INSERT WITH CHECK (auth.uid() = student_id);
CREATE POLICY "Students can read own submissions" ON submissions FOR SELECT USING (auth.uid() = student_id);
CREATE POLICY "Mentors can read/update assigned student submissions" ON submissions FOR ALL USING (
    EXISTS (
        SELECT 1 FROM mentorships 
        WHERE mentor_id = auth.uid() AND student_id = submissions.student_id AND active = true
    )
);

-- Student Progress: Students read/update own. Mentors read assigned. Admins full access.
CREATE POLICY "Admins full access to progress" ON student_progress FOR ALL USING (auth.jwt() ->> 'role' = 'admin');
CREATE POLICY "Students can access own progress" ON student_progress FOR ALL USING (auth.uid() = student_id);
CREATE POLICY "Mentors can read assigned student progress" ON student_progress FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM mentorships 
        WHERE mentor_id = auth.uid() AND student_id = student_progress.student_id AND active = true
    )
);

-- General Read-Only for Students (Courses, Modules)
CREATE POLICY "Anyone can read active courses" ON courses FOR SELECT USING (is_active = true);
CREATE POLICY "Anyone can read modules" ON modules FOR SELECT USING (true);
CREATE POLICY "Anyone can read published versions" ON module_versions FOR SELECT USING (is_published = true);

-- Broadcasts: Read access based on audience target
CREATE POLICY "Users can read targeted broadcasts" ON broadcasts FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM broadcast_audiences ba
        WHERE ba.broadcast_id = broadcasts.id
        AND (
            ba.role_target = (SELECT role FROM profiles WHERE id = auth.uid())
            OR 
            ba.cohort_target IN (SELECT cohort_id FROM cohort_students WHERE student_id = auth.uid())
        )
    )
);

-- ==========================================
-- Triggers and Functions
-- ==========================================

-- Trigger to sync mentor load
CREATE OR REPLACE FUNCTION sync_mentor_load()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' AND NEW.active = true THEN
        UPDATE mentor_settings SET current_load = current_load + 1 WHERE mentor_id = NEW.mentor_id;
    ELSIF TG_OP = 'UPDATE' THEN
        IF NEW.active = true AND OLD.active = false THEN
            UPDATE mentor_settings SET current_load = current_load + 1 WHERE mentor_id = NEW.mentor_id;
        ELSIF NEW.active = false AND OLD.active = true THEN
            UPDATE mentor_settings SET current_load = current_load - 1 WHERE mentor_id = NEW.mentor_id;
        END IF;
    ELSIF TG_OP = 'DELETE' AND OLD.active = true THEN
        UPDATE mentor_settings SET current_load = current_load - 1 WHERE mentor_id = OLD.mentor_id;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER on_mentorship_change
    AFTER INSERT OR UPDATE OR DELETE ON mentorships
    FOR EACH ROW EXECUTE FUNCTION sync_mentor_load();

-- Trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_student_progress_updated_at BEFORE UPDATE ON student_progress FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
