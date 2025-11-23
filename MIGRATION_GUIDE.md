# 🗄️ Database Migration Guide

## Quick Start: Run Migration

### Option 1: Via Supabase Dashboard (Recommended for First-Time Setup)

1. **Open Supabase Console:**
   - Go to: https://app.supabase.com/projects
   - Select project: `fcsmfkwsmlinzxvqlvml`

2. **Navigate to SQL Editor:**
   - Click "SQL Editor" in the left sidebar
   - Click "+ New Query"

3. **Copy Migration SQL:**
   - Open: `supabase/migrations/20251122_create_collaboration_schema.sql`
   - Copy all content

4. **Paste & Execute:**
   - Paste SQL into the query editor
   - Click "Run" button
   - Wait for completion (~5-10 seconds)

5. **Verify Tables Created:**
   - Go to "Table Editor" in sidebar
   - You should see:
     - `collaboration_rooms`
     - `operations`
     - `room_participants`

### Option 2: Via psql Command Line

```bash
# Prerequisites:
# 1. Have PostgreSQL psql client installed
# 2. Have DATABASE_URL environment variable set

cd void-backend

# Set the database URL (from .env or .env.local)
# DATABASE_URL=postgresql://postgres:PASSWORD@db.fcsmfkwsmlinzxvqlvml.supabase.co:5432/postgres

# Run the migration
psql $DATABASE_URL < supabase/migrations/20251122_create_collaboration_schema.sql
```

### Option 3: Via Node.js Script (Docker/Remote)

```bash
cd void-backend

# Install dependencies if not done
npm install

# Set database URL
export DATABASE_URL="postgresql://postgres:preetb121106@db.fcsmfkwsmlinzxvqlvml.supabase.co:5432/postgres"

# Note: The Node.js migrate script requires network access to PostgreSQL
# May fail due to firewall/DNS issues in some environments
node migrate.js
```

---

## 📋 What the Migration Creates

### Tables
1. **collaboration_rooms** - Stores active collaboration sessions
   - Columns: room_id, name, file_id, host, content, version, timestamps
   - Primary Index: room_id (UNIQUE)

2. **room_participants** - Tracks users in each room
   - Columns: room_id, user_id, user_name, joined_at, active
   - Foreign Key: room_id → collaboration_rooms

3. **operations** - Stores individual edit operations for OT
   - Columns: room_id, operation_id, user_id, data, version, created_at
   - Foreign Key: room_id → collaboration_rooms

### Indexes (7 total)
- `idx_rooms_room_id` - Fast room lookups
- `idx_rooms_created_at` - Sort by creation time
- `idx_rooms_file_id` - Filter by file
- `idx_operations_room_id` - Query operations by room
- `idx_operations_user_id` - Query operations by user
- `idx_operations_created_at` - Sort operations by time
- `idx_operations_version` - Version tracking
- `idx_participants_active` - Find active users

### Views
- **room_statistics** - Shows participant counts and stats per room

### Triggers
- Auto-update `updated_at` timestamps on modification

---

## ✅ Verification Checklist

After migration completes:

- [ ] Tables exist in Supabase
- [ ] Indexes created successfully
- [ ] Can insert test record into `collaboration_rooms`
- [ ] Can query `room_statistics` view
- [ ] Frontend compiles without errors
- [ ] Backend `/api/health` shows `database: connected`

---

## 🚀 Next Steps After Migration

1. **Rebuild Frontend:**
   ```bash
   cd ../void
   npm run build  # or use "VS Code - Build" task
   ```

2. **Test Collaboration Feature:**
   - Open VS Code
   - Click "Collaboration" in sidebar
   - Try "Start as Host"
   - Verify room is created in database

3. **Check Database:**
   - Go to Supabase → Table Editor
   - Click `collaboration_rooms` table
   - You should see your test room

---

## 📞 Troubleshooting

### "Table already exists" Error
- This is OK! Tables are idempotent (CREATE TABLE IF NOT EXISTS)
- No damage, safe to re-run

### "Permission denied" Error
- Verify service role key is correct
- Ensure PostgreSQL user has table creation permissions

### Tables don't appear in Table Editor
- Refresh the browser
- Check the "Schema" dropdown (should be "public")

### "Foreign key violation"
- Ensure `collaboration_rooms` table exists first
- Migration creates them in the correct order

---

## 🔄 Subsequent Migrations

Future migrations should:
1. Create new migration file: `supabase/migrations/YYYYMMDD_description.sql`
2. Follow same naming pattern (timestamp + description)
3. Be idempotent when possible (use IF NOT EXISTS/IF EXISTS)
4. Include comments explaining changes

All future migrations can be:
- Deployed via Supabase UI SQL Editor
- Or via Node.js script (once network issues resolved)
