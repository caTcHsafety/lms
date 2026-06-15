# 🚀 Quick Start - Production Setup

## ✅ What's Done
- All demo data cleaned from database (350+ records)
- Documentation and scripts created
- Changes pushed to GitHub

## 🎯 What You Need To Do (10 minutes)

### Step 1: Delete Test Users (2 minutes)
**Go to:** https://supabase.com/dashboard → Your Project → **Authentication** → **Users**

Delete these 5 users:
- ❌ admin_test@safetycatch.com
- ❌ testa@gmail.com
- ❌ mentor@safetycatch.in
- ❌ ads@safetycatch.in
- ❌ asd@safetycatch.in

### Step 2: Create Admin (5 minutes)

**Option A - Dashboard (Easiest):**
1. **Authentication** → **Users** → **Add user**
2. Email: `your-email@domain.com`
3. Password: `YourStrongPassword`
4. ✅ Check **Auto Confirm User**
5. Click **Create user**
6. Copy the user's UUID
7. Go to **SQL Editor**, run:
```sql
INSERT INTO profiles (id, email, full_name, role, is_active, must_reset_pw)
VALUES (
  'PASTE_UUID_HERE',
  'your-email@domain.com',
  'Your Name',
  'admin',
  true,
  false
);
```

**Option B - SQL Script:**
1. Open `scripts/create_admin.sql`
2. Change email, password, name
3. Run in **SQL Editor**

### Step 3: Test Login (1 minute)
- Go to your app
- Log in with new admin credentials
- Verify you see admin dashboard

### Step 4: Configure Email (Optional, 2 minutes)
**Project Settings** → **Auth** → **SMTP Settings**

Example (Gmail):
```
Host: smtp.gmail.com
Port: 587
User: your-email@gmail.com
Password: your-app-password
Sender: noreply@yourdomain.com
```

---

## 📚 Full Documentation

| File | What It Is |
|------|-----------|
| `CLEANUP_COMPLETE_SUMMARY.md` | ⭐ Start here - Full cleanup summary |
| `DELETE_USERS_AND_CREATE_ADMIN.md` | Detailed user management guide |
| `PRODUCTION_SETUP_GUIDE.md` | Complete production setup |
| `scripts/create_admin.sql` | SQL script to create admin |
| `scripts/delete_test_users.sql` | SQL script to delete test users |

---

## 🆘 Quick Troubleshooting

**"Cannot delete users"**
→ Use Supabase Dashboard instead of SQL

**"Email already exists"**
→ Delete old user from Dashboard first

**Cannot login**
→ Check email is confirmed (auto-confirm was checked)
→ Verify role is 'admin' (lowercase)

---

## ✅ Checklist

- [ ] Delete 5 test users
- [ ] Create production admin
- [ ] Test admin login
- [ ] Configure SMTP (recommended)
- [ ] Create first course
- [ ] Ready to use! 🎉
