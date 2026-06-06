-- Fix RLS policies to allow Admins full access and ensure robust, recursion-free role checking via JWT app_metadata.

-- Profiles
DROP POLICY IF EXISTS "Admins have full access to profiles" ON profiles;
CREATE POLICY "Admins have full access to profiles" ON profiles 
    FOR ALL TO authenticated 
    USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
    WITH CHECK ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

-- Submissions
DROP POLICY IF EXISTS "Admins full access to submissions" ON submissions;
CREATE POLICY "Admins full access to submissions" ON submissions 
    FOR ALL TO authenticated 
    USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
    WITH CHECK ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

-- Student Progress
DROP POLICY IF EXISTS "Admins full access to progress" ON student_progress;
CREATE POLICY "Admins full access to progress" ON student_progress 
    FOR ALL TO authenticated 
    USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
    WITH CHECK ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

-- Courses
DROP POLICY IF EXISTS "Admins have full access to courses" ON courses;
CREATE POLICY "Admins have full access to courses" ON courses 
    FOR ALL TO authenticated 
    USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
    WITH CHECK ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

-- Subjects
DROP POLICY IF EXISTS "Admins have full access to subjects" ON subjects;
CREATE POLICY "Admins have full access to subjects" ON subjects 
    FOR ALL TO authenticated 
    USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
    WITH CHECK ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

DROP POLICY IF EXISTS "Everyone can read subjects" ON subjects;
CREATE POLICY "Everyone can read subjects" ON subjects 
    FOR SELECT TO authenticated 
    USING (true);

-- Modules
DROP POLICY IF EXISTS "Admins have full access to modules" ON modules;
CREATE POLICY "Admins have full access to modules" ON modules 
    FOR ALL TO authenticated 
    USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
    WITH CHECK ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

-- Module Versions
DROP POLICY IF EXISTS "Admins have full access to module_versions" ON module_versions;
CREATE POLICY "Admins have full access to module_versions" ON module_versions 
    FOR ALL TO authenticated 
    USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
    WITH CHECK ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

-- Cohort Modules
DROP POLICY IF EXISTS "Admins have full access to cohort_modules" ON cohort_modules;
CREATE POLICY "Admins have full access to cohort_modules" ON cohort_modules 
    FOR ALL TO authenticated 
    USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
    WITH CHECK ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

DROP POLICY IF EXISTS "Everyone can read cohort_modules" ON cohort_modules;
CREATE POLICY "Everyone can read cohort_modules" ON cohort_modules 
    FOR SELECT TO authenticated 
    USING (true);

-- Module Trainers
DROP POLICY IF EXISTS "Admins have full access to module_trainers" ON module_trainers;
CREATE POLICY "Admins have full access to module_trainers" ON module_trainers 
    FOR ALL TO authenticated 
    USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
    WITH CHECK ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

DROP POLICY IF EXISTS "Everyone can read module_trainers" ON module_trainers;
CREATE POLICY "Everyone can read module_trainers" ON module_trainers 
    FOR SELECT TO authenticated 
    USING (true);

-- Mentor Settings
DROP POLICY IF EXISTS "Admins have full access to mentor_settings" ON mentor_settings;
CREATE POLICY "Admins have full access to mentor_settings" ON mentor_settings 
    FOR ALL TO authenticated 
    USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
    WITH CHECK ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

DROP POLICY IF EXISTS "Everyone can read mentor_settings" ON mentor_settings;
CREATE POLICY "Everyone can read mentor_settings" ON mentor_settings 
    FOR SELECT TO authenticated 
    USING (true);

-- Mentorships
DROP POLICY IF EXISTS "Admins have full access to mentorships" ON mentorships;
CREATE POLICY "Admins have full access to mentorships" ON mentorships 
    FOR ALL TO authenticated 
    USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
    WITH CHECK ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

DROP POLICY IF EXISTS "Everyone can read mentorships" ON mentorships;
CREATE POLICY "Everyone can read mentorships" ON mentorships 
    FOR SELECT TO authenticated 
    USING (true);
