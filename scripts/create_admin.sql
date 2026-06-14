-- ==========================================
-- CREATE PRODUCTION ADMIN ACCOUNT
-- ==========================================
-- Instructions:
-- 1. Replace 'YOUR_EMAIL_HERE' with your actual admin email
-- 2. Replace 'YOUR_PASSWORD_HERE' with a strong password
-- 3. Replace 'YOUR_NAME_HERE' with your full name
-- 4. Run this script in Supabase SQL Editor
-- ==========================================

-- Enable required extension
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Create admin user
DO $$
DECLARE
  new_user_id uuid;
  admin_email text := 'YOUR_EMAIL_HERE@example.com';  -- ⚠️ CHANGE THIS
  admin_password text := 'YOUR_PASSWORD_HERE';  -- ⚠️ CHANGE THIS
  admin_fullname text := 'YOUR_NAME_HERE';  -- ⚠️ CHANGE THIS
BEGIN
  -- Generate new UUID
  new_user_id := gen_random_uuid();
  
  -- Create user in auth.users table
  INSERT INTO auth.users (
    instance_id,
    id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    confirmation_sent_at,
    confirmed_at,
    last_sign_in_at,
    raw_app_meta_data,
    raw_user_meta_data,
    is_super_admin,
    created_at,
    updated_at
  ) VALUES (
    '00000000-0000-0000-0000-000000000000',
    new_user_id,
    'authenticated',
    'authenticated',
    admin_email,
    crypt(admin_password, gen_salt('bf')),
    NOW(),  -- Email already confirmed
    NOW(),
    NOW(),
    NOW(),
    jsonb_build_object('provider', 'email', 'providers', ARRAY['email']),
    jsonb_build_object('full_name', admin_fullname),
    false,
    NOW(),
    NOW()
  );
  
  -- Create profile
  INSERT INTO profiles (
    id,
    email,
    full_name,
    role,
    is_active,
    must_reset_pw,
    created_at,
    updated_at
  ) VALUES (
    new_user_id,
    admin_email,
    admin_fullname,
    'admin',
    true,
    false,
    NOW(),
    NOW()
  );
  
  -- Output success message
  RAISE NOTICE '✅ Admin user created successfully!';
  RAISE NOTICE 'User ID: %', new_user_id;
  RAISE NOTICE 'Email: %', admin_email;
  RAISE NOTICE 'Role: admin';
  RAISE NOTICE '';
  RAISE NOTICE '🔐 You can now log in at your app URL with:';
  RAISE NOTICE 'Email: %', admin_email;
  RAISE NOTICE 'Password: (the one you set above)';
  RAISE NOTICE '';
  RAISE NOTICE '⚠️ Important: Change your password after first login!';
  
EXCEPTION
  WHEN unique_violation THEN
    RAISE NOTICE '❌ Error: User with email % already exists!', admin_email;
    RAISE NOTICE 'Please delete the existing user first or use a different email.';
  WHEN OTHERS THEN
    RAISE NOTICE '❌ Error creating admin user: %', SQLERRM;
    RAISE NOTICE 'Please check the error message and try again.';
END $$;

-- Verify the admin was created
SELECT 
  id, 
  email, 
  full_name, 
  role, 
  is_active,
  created_at
FROM profiles 
WHERE role = 'admin'
ORDER BY created_at DESC;
