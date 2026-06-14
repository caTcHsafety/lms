# Production Setup Guide - Clean Database & Admin Account

## Step 1: Clean Up Demo Data

### A. Clean Supabase Database

1. **Apply the cleanup migration:**
   ```bash
   cd supabase
   supabase db push
   ```

   Or manually run the migration:
   ```bash
   supabase db execute -f migrations/20260615000000_cleanup_demo_data.sql
   ```

2. **Delete Auth Users (Important!):**
   
   Go to your Supabase Dashboard:
   - Navigate to: `Authentication` > `Users`
   - Delete all test users manually
   
   OR use SQL in Supabase SQL Editor:
   ```sql
   -- WARNING: This deletes all users and their profiles
   -- Make sure you have access to create new admin user
   SELECT auth.uid, email FROM auth.users;
   
   -- Delete profiles first (they cascade from auth.users)
   DELETE FROM auth.users;
   ```

### B. Clean Cloudflare R2 Storage

The R2 bucket `lms-ispring-content` contains uploaded files. To clean:

**Option 1: Delete all objects via Cloudflare Dashboard**
1. Go to Cloudflare Dashboard > R2
2. Open bucket: `lms-ispring-content`
3. Select all objects and delete

**Option 2: Use Cloudflare API/Wrangler CLI**
```bash
# Install wrangler if not already
npm install -g wrangler

# Login
wrangler login

# List objects
wrangler r2 object list lms-ispring-content

# Delete all (use with caution!)
# You may need to delete objects individually or in batches
```

**Option 3: Keep the bucket structure**
The demo upload was in: `cohort-uploads/` prefix
- You can leave the bucket empty or delete specific prefixes

---

## Step 2: Create Admin Account from Scratch

### Method 1: Using Supabase Dashboard (Recommended)

1. **Go to Supabase Dashboard:**
   - Navigate to: `Authentication` > `Users`
   - Click `Add user` > `Create new user`

2. **Fill in admin details:**
   - Email: `your-admin-email@domain.com`
   - Password: Set a strong password
   - ✅ Check "Auto Confirm User" (bypasses email verification)

3. **Create the profile in database:**
   
   Go to: `SQL Editor` and run:
   ```sql
   -- Get the newly created user ID
   SELECT id, email FROM auth.users ORDER BY created_at DESC LIMIT 1;
   
   -- Insert admin profile (replace USER_ID with actual ID from above)
   INSERT INTO profiles (id, email, full_name, role, is_active, must_reset_pw)
   VALUES (
     'USER_ID_HERE',  -- Replace with actual user ID
     'your-admin-email@domain.com',
     'Admin User',
     'admin',
     true,
     false  -- Set to true if you want them to reset password on first login
   );
   ```

### Method 2: Using SQL Only (Advanced)

Run this in Supabase SQL Editor:

```sql
-- Create auth user and profile in one transaction
DO $$
DECLARE
  new_user_id uuid;
BEGIN
  -- Create user in auth.users
  INSERT INTO auth.users (
    instance_id,
    id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    recovery_sent_at,
    last_sign_in_at,
    raw_app_meta_data,
    raw_user_meta_data,
    created_at,
    updated_at,
    confirmation_token,
    email_change,
    email_change_token_new,
    recovery_token
  ) VALUES (
    '00000000-0000-0000-0000-000000000000',
    gen_random_uuid(),
    'authenticated',
    'authenticated',
    'admin@yourdomain.com',  -- CHANGE THIS
    crypt('YourStrongPassword123!', gen_salt('bf')),  -- CHANGE THIS
    NOW(),  -- Email already confirmed
    NOW(),
    NOW(),
    '{"provider":"email","providers":["email"]}',
    '{}',
    NOW(),
    NOW(),
    '',
    '',
    '',
    ''
  )
  RETURNING id INTO new_user_id;
  
  -- Create profile
  INSERT INTO profiles (id, email, full_name, role, is_active, must_reset_pw)
  VALUES (
    new_user_id,
    'admin@yourdomain.com',  -- CHANGE THIS
    'System Administrator',
    'admin',
    true,
    false
  );
  
  RAISE NOTICE 'Admin user created with ID: %', new_user_id;
END $$;
```

---

## Step 3: Configure Email Verification

### Enable Email Confirmation in Supabase

1. **Go to Supabase Dashboard:**
   - Navigate to: `Authentication` > `Settings`

2. **Email Templates:**
   - Click on `Email Templates`
   - Customize the "Confirm signup" email template

3. **Enable Email Confirmation:**
   - Under `Authentication` > `Settings` > `Auth`
   - Ensure "Enable email confirmations" is ON
   - Set "Confirm email" to required

4. **Configure SMTP (Required for production):**
   - Go to: `Project Settings` > `Auth`
   - Scroll to "SMTP Settings"
   - Enable custom SMTP or use Supabase's built-in
   
   **For Custom SMTP (recommended):**
   ```
   SMTP Host: smtp.gmail.com (for Gmail)
   SMTP Port: 587
   SMTP User: your-email@gmail.com
   SMTP Password: your-app-password
   Sender Email: noreply@yourdomain.com
   Sender Name: Your LMS Name
   ```

5. **Test Email Confirmation:**
   - Create a test user (without auto-confirm)
   - Check if confirmation email arrives
   - Click link to verify it works

---

## Step 4: Update Environment Variables

Make sure your production `.env` has:

```env
# Supabase
VITE_SUPABASE_URL=your-production-supabase-url
VITE_SUPABASE_ANON_KEY=your-production-anon-key

# Cloudflare R2
VITE_R2_PUBLIC_URL=your-r2-public-url
R2_ACCOUNT_ID=your-account-id
R2_ACCESS_KEY_ID=your-access-key
R2_SECRET_ACCESS_KEY=your-secret-key
R2_BUCKET_NAME=lms-ispring-content
```

---

## Step 5: Verification Checklist

After cleanup and admin creation:

- [ ] All demo data deleted from database
- [ ] All test users deleted from auth.users
- [ ] R2 bucket cleaned or empty
- [ ] Admin account created successfully
- [ ] Admin can log in to the app
- [ ] Email verification is working (if enabled)
- [ ] Production environment variables are set
- [ ] App is deployed and accessible

---

## Troubleshooting

### Cannot create admin user
- Check if auth.users table is accessible
- Verify RLS policies allow admin creation
- Try using Supabase Dashboard instead of SQL

### Email verification not working
- Check SMTP settings in Supabase
- Verify email template is configured
- Check spam folder for confirmation emails
- Test with a real email address

### R2 bucket access issues
- Verify R2 credentials in environment variables
- Check bucket CORS settings if needed
- Ensure bucket name matches in code

---

## Important Security Notes

1. **Change default admin password** immediately after first login
2. **Enable 2FA** for admin account (if supported)
3. **Set up proper SMTP** - don't use Supabase's default for production
4. **Regular backups** - Set up automated Supabase backups
5. **Monitor activity** - Check activity_events table regularly
6. **RLS policies** - Ensure all tables have proper RLS enabled

---

## Next Steps After Setup

1. Create your first real course/subject/module
2. Set up cohorts for your actual students
3. Configure assignment templates
4. Set up broadcast templates for announcements
5. Train your trainers/mentors on the system
6. Import or create student accounts

---

## Support

If you encounter issues:
1. Check Supabase logs: Dashboard > Logs
2. Check browser console for errors
3. Verify all environment variables are correct
4. Check RLS policies are not blocking operations
