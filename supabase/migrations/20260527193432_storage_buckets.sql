-- Set up Storage Buckets

-- 1. Lesson Assets (Trainer/Content Vault)
INSERT INTO storage.buckets (id, name, public) VALUES ('lesson_assets', 'lesson_assets', false);

-- Enable RLS
CREATE POLICY "Admins have full access to lesson_assets" ON storage.objects FOR ALL USING (bucket_id = 'lesson_assets' AND auth.jwt() ->> 'role' = 'admin');
CREATE POLICY "Trainers can read lesson_assets" ON storage.objects FOR SELECT USING (bucket_id = 'lesson_assets' AND auth.jwt() ->> 'role' = 'trainer');
CREATE POLICY "Students can read lesson_assets" ON storage.objects FOR SELECT USING (bucket_id = 'lesson_assets' AND auth.jwt() ->> 'role' = 'student');

-- 2. Student Submissions (Evaluations)
INSERT INTO storage.buckets (id, name, public) VALUES ('student_submissions', 'student_submissions', false);

-- Enable RLS
CREATE POLICY "Admins have full access to submissions" ON storage.objects FOR ALL USING (bucket_id = 'student_submissions' AND auth.jwt() ->> 'role' = 'admin');

-- Students can only upload and read their own submissions
CREATE POLICY "Students can upload own submissions" ON storage.objects FOR INSERT WITH CHECK (
    bucket_id = 'student_submissions' AND 
    auth.uid()::text = (storage.foldername(name))[1]
);
CREATE POLICY "Students can read own submissions" ON storage.objects FOR SELECT USING (
    bucket_id = 'student_submissions' AND 
    auth.uid()::text = (storage.foldername(name))[1]
);

-- Mentors can read submissions of their assigned students
-- Note: Requires a function to check mentorship mapping since storage.objects doesn't join directly easily in policy
CREATE OR REPLACE FUNCTION public.is_assigned_mentor(student_uuid UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.mentorships 
    WHERE mentor_id = auth.uid() AND student_id = student_uuid AND active = true
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE POLICY "Mentors can read assigned student submissions" ON storage.objects FOR SELECT USING (
    bucket_id = 'student_submissions' AND 
    auth.jwt() ->> 'role' = 'mentor' AND
    public.is_assigned_mentor((storage.foldername(name))[1]::uuid)
);
