# Delete Test Users and Create Production Admin

## Current Status ✅

**Database cleanup completed:**
- ✅ All courses, subjects, modules deleted
- ✅ All cohorts and assignments deleted  
- ✅ All submissions deleted
- ✅ All activity events deleted (337 records)
- ✅ All broadcasts deleted

**Remaining: 5 test user accounts**

| Email | Role | Name |
|-------|------|------|
| admin_test@safetycatch.com | admin | Test Admin |
| testa@gmail.com | trainer | testa |
| mentor@safetycatch.in | mentor | mentor |
| ads@safetycatch.in | student | ads |
| asd@safetycatch.in | student | new |

---

## Step 1: Delete All Test Users

### Option A: Using Supabase Dashboard (Easiest)

1. Go to your Supabase project dashboard
2. Navigate to: **Authentication** → **Users**
3. You'll see all 5 users listed
4. Click on each user and select **Delete user**
5. Confirm deletion for each

### Option B: Using SQL (Automated)

**⚠️ WARNING: This will delete ALL users. Make sure you're ready to create a new admin.**

Run this in Supabase SQL Editor:

```sql
-- Step 1: Delete all profiles (this cascades properly)
DELETE FROM profiles;

-- Step 2: Delete all auth users
-- Note: You need to be careful with auth.users as it's in a different schema
-- The profiles table deletion should cascade via foreign key

-- Verify all users are gone
SELECT COUNT(*) as remaining_users FROM profiles;
SELECT COUNT(*) as remaining_auth_users FROM auth.users;
```

**If the above doesn't delete auth.users, use this:**

```sql
-- List all auth user IDs
SELECT id, email FROM auth.users;

-- Delete them one by one (Supabase may require this)
DELETE FROM auth.users WHERE email = 'admin_test@safetycatch.com';
DELETE FROM auth.users WHERE email = 'testa@gmail.com';
DELETE FROM auth.users WHERE email = 'mentor@safetycatch.in';
DELETE FROM auth.users WHERE email = 'ads@safetycatch.in';
DELETE FROM auth.users WHERE email = 'asd@safetycatch.in';
```

---

## Step 2: Clean Cloudflare R2 Bucket

### Check what's in the bucket

The bucket name is: **lms-ispring-content**

**Option 1: Via Cloudflare Dashboard**
1. Go to: https://dash.cloudflare.com/
2. Select your account
3. Navigate to: **R2** → **lms-ispring-content**
4. View objects and delete all demo files

**Option 2: Leave it empty for now**
- The demo upload was in `cohort-uploads/` folder
- Since we deleted the cohort_uploads records, these files are orphaned
- You can delete them later or leave them (won't affect the app)

---

## Step 3: Create Production Admin Account

### Method 1: Supabase Dashboard (Recommended) ⭐

1. **Create Auth User:**
   - Go to: **Authentication** → **Users**
   - Click: **Add user** → **Create new user**
   - Fill in:
     - **Email**: `your-real-admin-email@domain.com`
     - **Password**: `YourStrongPassword123!`
     - ✅ **Auto Confirm User**: CHECK THIS BOX
   - Click **Create user**

2. **Get the User ID:**
   - The user will appear in the list
   - Click on the user to see details
   - Copy the **UUID** (it's a long ID like `a1b2c3d4-...`)

3. **Create Profile in Database:**
   - Go to: **SQL Editor**
   - Run this query (replace the ID and email):

```sql
-- Replace USER_ID_HERE with the UUID from step 2
-- Replace EMAIL with your admin email
INSERT INTO profiles (id, email, full_name, role, is_active, must_reset_pw)
VALUES (
  'USER_ID_HERE',  -- Paste the UUID here
  'your-admin-email@domain.com',  -- Your email
  'System Administrator',  -- Your full name
  'admin',  -- Role
  true,  -- Active
  false  -- Don't require password reset
);
```

### Method 2: Pure SQL (All in one) 🚀

**⚠️ Note:** This method creates both auth user and profile in one go, but requires pg_crypto extension.

Run this in **Supabase SQL Editor**:

```sql
-- Check if pg_crypto extension is enabled
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Create admin user and profile
DO $$
DECLARE
  new_user_id uuid;
  admin_email text := 'admin@yourdomain.com';  -- CHANGE THIS
  admin_password text := 'YourStrongPassword123!';  -- CHANGE THIS
  admin_fullname text := 'System Administrator';  -- CHANGE THIS
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
    NOW(),
    NOW(),
    NOW(),
    NOW(),
    jsonb_build_object('provider', 'email', 'providers', ARRAY['email']),
    '{}',
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
  RAISE NOTICE 'Admin user created successfully!';
  RAISE NOTICE 'User ID: %', new_user_id;
  RAISE NOTICE 'Email: %', admin_email;
  RAISE NOTICE 'You can now log in with these credentials.';
END $$;
```

### Method 3: Using Supabase CLI (For Advanced Users)

```bash
# Make sure you're logged in
supabase login

# Create a user (this only creates auth user, you'll need to create profile separately)
supabase users create admin@yourdomain.com --password "YourStrongPassword123!"

# Then run the INSERT INTO profiles query from Method 1
```

---

## Step 4: Configure Email Verification (Production)

### Enable Email Confirmations

1. **Go to Supabase Dashboard:**
   - **Authentication** → **Settings** → **Auth**

2. **Email Confirmations:**
   - Toggle ON: **Enable email confirmations**
   - This will require new users to confirm their email

3. **Configure SMTP (Important for production!):**
   
   Go to: **Project Settings** → **Auth** → **Email**
   
   **Option A: Use Supabase's built-in email (for testing)**
   - Already configured, but has rate limits
   - Not recommended for production

   **Option B: Custom SMTP (Recommended for production)**
   
   Example for Gmail:
   ```
   SMTP Host: smtp.gmail.com
   SMTP Port: 587
   SMTP User: your-email@gmail.com
   SMTP Password: your-app-specific-password  (Not regular password!)
   Sender Email: noreply@yourdomain.com
   Sender Name: SafetyCatch LMS
   ```

   Example for SendGrid:
   ```
   SMTP Host: smtp.sendgrid.net
   SMTP Port: 587
   SMTP User: apikey
   SMTP Password: your-sendgrid-api-key
   Sender Email: noreply@yourdomain.com
   Sender Name: SafetyCatch LMS
   ```

4. **Customize Email Templates:**
   
   Go to: **Authentication** → **Email Templates**
   
   **Templates to customize:**
   - **Confirm signup**: Email sent to new users
   - **Magic Link**: For passwordless login
   - **Change Email Address**: When user changes email
   - **Reset Password**: For password recovery

   **Example Confirm Signup Template:**
   ```html
   <h2>Confirm your signup</h2>
   <p>Follow this link to confirm your email:</p>
   <p><a href="{{ .ConfirmationURL }}">Confirm Email</a></p>
   ```

---

## Step 5: Test Admin Login

1. **Go to your app URL**: `https://your-app-domain.com`

2. **Log in with admin credentials:**
   - Email: The one you created
   - Password: The password you set

3. **Verify admin access:**
   - You should see the admin dashboard
   - Check Content Vault, User Management, System Analytics tabs
   - All should be empty (fresh start!)

---

## Step 6: Final Verification

Run this query to verify everything is clean and admin exists:

```sql
-- Verify clean database
SELECT 
  'profiles' as table_name, COUNT(*) as count, 
  string_agg(DISTINCT role::text, ', ') as roles
FROM profiles
UNION ALL
SELECT 'courses', COUNT(*), NULL FROM courses
UNION ALL
SELECT 'modules', COUNT(*), NULL FROM modules
UNION ALL
SELECT 'cohorts', COUNT(*), NULL FROM cohorts
UNION ALL
SELECT 'submissions', COUNT(*), NULL FROM submissions
UNION ALL
SELECT 'activity_events', COUNT(*), NULL FROM activity_events;

-- Should show:
-- profiles: 1, roles: admin
-- Everything else: 0
```

---

## Troubleshooting

### "Email already exists" error
- The auth.users table still has the old user
- Delete it manually from Supabase Dashboard → Authentication → Users

### Cannot log in with new admin
- Check if email confirmation is required (disable it for admin)
- Verify the profile was created with `role = 'admin'`
- Check browser console for errors

### Email verification not sending
- Check SMTP settings
- Verify Supabase email quota (free tier has limits)
- Check spam folder
- Test with a real email service (not temporary email)

### "User already exists in profiles"
- The profile table still has the user
- Delete it: `DELETE FROM profiles WHERE email = 'your-email@domain.com';`
- Then retry creating admin

---

## Security Checklist

After setting up admin:

- [ ] Changed default password to a strong one (16+ characters)
- [ ] Email verification is enabled for new users
- [ ] SMTP is configured with proper credentials
- [ ] Admin email is a real, monitored email address
- [ ] Database backups are enabled in Supabase
- [ ] RLS policies are enabled on all tables
- [ ] Environment variables are secured
- [ ] R2 bucket CORS is properly configured

---

## Next Steps

1. ✅ Database cleaned
2. ✅ Test users deleted
3. ✅ Admin account created
4. ⬜ Create first real course
5. ⬜ Set up trainers/mentors
6. ⬜ Import or create students
7. ⬜ Configure cohorts
8. ⬜ Start using the system!

---

## Quick Reference: Supabase SQL Queries

```sql
-- Check current users
SELECT id, email, role, is_active FROM profiles;

-- Check auth users
SELECT id, email, email_confirmed_at FROM auth.users;

-- Delete specific user (replace email)
DELETE FROM auth.users WHERE email = 'user@example.com';

-- Verify tables are empty
SELECT 
  (SELECT COUNT(*) FROM courses) as courses,
  (SELECT COUNT(*) FROM modules) as modules,
  (SELECT COUNT(*) FROM cohorts) as cohorts;
```
