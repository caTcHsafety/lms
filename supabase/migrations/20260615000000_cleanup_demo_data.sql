-- ==========================================
-- CLEANUP ALL DEMO DATA
-- Run this migration to remove all test/demo data
-- WARNING: This will delete ALL data in the database
-- ==========================================

-- Disable foreign key checks temporarily (not needed in Postgres, cascades handle it)

-- 1. Clean up activity events (largest table)
DELETE FROM activity_events;

-- 2. Clean up broadcasts and related data
DELETE FROM broadcast_acks;
DELETE FROM broadcast_audiences;
DELETE FROM broadcasts;

-- 3. Clean up submissions
DELETE FROM submissions;

-- 4. Clean up assignments
DELETE FROM assignment_files;
DELETE FROM assignment_cohorts;
DELETE FROM assignments;

-- 5. Clean up cohort-related data
DELETE FROM cohort_uploads;
DELETE FROM cohort_students;
DELETE FROM cohort_modules;
DELETE FROM cohorts;

-- 6. Clean up student progress
DELETE FROM student_progress;
DELETE FROM learning_streaks;

-- 7. Clean up mentorships
DELETE FROM mentorships;
DELETE FROM mentor_settings;

-- 8. Clean up module-related data
DELETE FROM module_trainers;
DELETE FROM module_versions;
DELETE FROM modules;

-- 9. Clean up subjects
DELETE FROM subjects;

-- 10. Clean up courses
DELETE FROM courses;

-- 11. Clean up all user profiles (except we'll keep this for manual deletion)
-- DO NOT DELETE profiles here - we'll handle auth.users separately
-- DELETE FROM profiles;

-- Reset sequences (if any auto-increment columns exist)
-- Postgres uses sequences for serial/bigserial columns
-- Our tables use UUIDs, so no sequences to reset

-- ==========================================
-- NOTE: To delete user accounts:
-- 1. Go to Supabase Dashboard > Authentication > Users
-- 2. Delete all test users manually
-- OR use the Supabase API/CLI to delete users
-- ==========================================

-- Verification query
SELECT 
  'activity_events' as table_name, COUNT(*) as count FROM activity_events
UNION ALL
SELECT 'broadcasts', COUNT(*) FROM broadcasts
UNION ALL
SELECT 'submissions', COUNT(*) FROM submissions
UNION ALL
SELECT 'assignments', COUNT(*) FROM assignments
UNION ALL
SELECT 'cohorts', COUNT(*) FROM cohorts
UNION ALL
SELECT 'modules', COUNT(*) FROM modules
UNION ALL
SELECT 'subjects', COUNT(*) FROM subjects
UNION ALL
SELECT 'courses', COUNT(*) FROM courses
UNION ALL
SELECT 'profiles', COUNT(*) FROM profiles;
