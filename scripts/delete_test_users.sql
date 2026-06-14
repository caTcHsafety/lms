-- ==========================================
-- DELETE ALL TEST USERS
-- ==========================================
-- ⚠️ WARNING: This will delete ALL user accounts
-- Make sure you're ready to create a fresh admin account
-- ==========================================

-- Step 1: Show current users before deletion
SELECT '=== CURRENT USERS (BEFORE DELETION) ===' as info;
SELECT 
  email, 
  role, 
  full_name,
  created_at
FROM profiles 
ORDER BY role, email;

-- Step 2: Delete all profiles (this should cascade to related data)
DELETE FROM profiles;

-- Step 3: Delete auth users (in case cascade didn't work)
-- Note: This deletes from auth schema which may require special permissions
-- If this fails, delete users manually from Supabase Dashboard
DELETE FROM auth.users 
WHERE email IN (
  'admin_test@safetycatch.com',
  'testa@gmail.com',
  'mentor@safetycatch.in',
  'ads@safetycatch.in',
  'asd@safetycatch.in'
);

-- Step 4: Verify all users are deleted
SELECT '=== VERIFICATION (SHOULD BE EMPTY) ===' as info;
SELECT COUNT(*) as remaining_profiles FROM profiles;
SELECT COUNT(*) as remaining_auth_users FROM auth.users;

-- Step 5: Final check
SELECT 
  CASE 
    WHEN (SELECT COUNT(*) FROM profiles) = 0 THEN '✅ All profiles deleted successfully'
    ELSE '⚠️ Some profiles still remain - check manually'
  END as profile_status,
  CASE 
    WHEN (SELECT COUNT(*) FROM auth.users) = 0 THEN '✅ All auth users deleted successfully'
    ELSE '⚠️ Some auth users still remain - delete from Dashboard'
  END as auth_status;
