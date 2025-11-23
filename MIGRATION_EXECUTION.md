# 🗄️ Database Migration - Execution Guide

> ⚠️ **Network Issue Detected**: The local environment cannot reach Supabase database directly.
>
> This is normal in isolated/sandboxed environments. Use the **Web Method** below instead.

---

## ✅ RECOMMENDED: Method 1 - Supabase Web UI (Fastest)

### Step 1: Copy the Migration SQL
```
File to copy: void-backend/supabase/migrations/20251122_create_collaboration_schema.sql
```

### Step 2: Open Supabase Console
1. Visit: https://app.supabase.com/projects
2. Select: **fcsmfkwsmlinzxvqlvml**
3. Click: **SQL Editor** (left sidebar)
4. Click: **+ New Query**

### Step 3: Paste & Execute
1. **Paste** the migration SQL into the editor
2. Click **Run** (or press Ctrl+Enter)
3. Wait for completion (should be instant)

### Step 4: Verify
1. Go to **Table Editor**
2. Confirm tables exist:
   - ✅ collaboration_rooms
   - ✅ operations
   - ✅ room_participants

---

## 📋 Migration SQL Content

If you can't access files, here's the SQL to run manually:

```sql
-- Void Backend Database Schema for Supabase
-- Migration: Create collaboration tables and indexes
-- Created: 2025-11-22

-- ============================================================
-- 1. COLLABORATION ROOMS TABLE
-- ============================================================

CREATE TABLE IF NOT EXISTS collaboration_rooms (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  room_id TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  file_id TEXT NOT NULL,
  host TEXT NOT NULL,
  content TEXT,
  version INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_rooms_room_id ON collaboration_rooms(room_id);
CREATE INDEX IF NOT EXISTS idx_rooms_created_at ON collaboration_rooms(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_rooms_file_id ON collaboration_rooms(file_id);

-- ============================================================
-- 2. OPERATIONS TABLE
-- ============================================================

CREATE TABLE IF NOT EXISTS operations (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  room_id TEXT NOT NULL,
  operation_id TEXT NOT NULL UNIQUE,
  user_id TEXT NOT NULL,
  data JSONB,
  version INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  FOREIGN KEY (room_id) REFERENCES collaboration_rooms(room_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_operations_room_id ON operations(room_id);
CREATE INDEX IF NOT EXISTS idx_operations_user_id ON operations(user_id);
CREATE INDEX IF NOT EXISTS idx_operations_created_at ON operations(created_at);
CREATE INDEX IF NOT EXISTS idx_operations_version ON operations(version);

-- ============================================================
-- 3. ROOM PARTICIPANTS TABLE
-- ============================================================

CREATE TABLE IF NOT EXISTS room_participants (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  room_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  user_name TEXT NOT NULL,
  joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  active BOOLEAN DEFAULT TRUE,
  FOREIGN KEY (room_id) REFERENCES collaboration_rooms(room_id) ON DELETE CASCADE,
  UNIQUE(room_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_participants_room_id ON room_participants(room_id);
CREATE INDEX IF NOT EXISTS idx_participants_active ON room_participants(active);

-- ============================================================
-- 4. VIEWS
-- ============================================================

CREATE OR REPLACE VIEW room_statistics AS
SELECT
  cr.id,
  cr.room_id,
  cr.name,
  cr.file_id,
  cr.host,
  cr.version,
  cr.created_at,
  cr.updated_at,
  COUNT(DISTINCT rp.user_id) as participant_count,
  COUNT(CASE WHEN rp.active = true THEN 1 END) as active_participant_count
FROM collaboration_rooms cr
LEFT JOIN room_participants rp ON cr.room_id = rp.room_id
GROUP BY cr.id, cr.room_id, cr.name, cr.file_id, cr.host, cr.version, cr.created_at, cr.updated_at;

-- ============================================================
-- 5. TRIGGERS & FUNCTIONS
-- ============================================================

-- Function to auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger to update updated_at on collaboration_rooms
DROP TRIGGER IF EXISTS update_collaboration_rooms_updated_at ON collaboration_rooms;
CREATE TRIGGER update_collaboration_rooms_updated_at
    BEFORE UPDATE ON collaboration_rooms
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- END OF MIGRATION
-- ============================================================
```

---

## 🔧 Method 2 - Supabase CLI (If installed)

```bash
# Login to Supabase
supabase login

# Link project
supabase link --project-ref fcsmfkwsmlinzxvqlvml

# Push migrations
supabase migration up
```

---

## 🐳 Method 3 - Docker PostgreSQL (Local Testing)

```bash
# Start local PostgreSQL
docker run --name supabase-postgres \
  -e POSTGRES_PASSWORD=postgres \
  -p 5432:5432 \
  postgres:15

# Run migration
psql postgresql://postgres:postgres@localhost:5432/postgres < supabase/migrations/20251122_create_collaboration_schema.sql
```

---

## ✨ What Gets Created

| Component | Count | Details |
|-----------|-------|---------|
| Tables | 3 | rooms, participants, operations |
| Indexes | 7 | Performance optimization |
| Views | 1 | room_statistics with counts |
| Triggers | 1 | Auto-update timestamps |
| Functions | 1 | Timestamp update function |

---

## ✅ Verification Checklist

After migration:

- [ ] Can see all 3 tables in Supabase Table Editor
- [ ] Tables have all expected columns
- [ ] Indexes appear in table details
- [ ] Can insert test row: `INSERT INTO collaboration_rooms (room_id, name, file_id, host) VALUES ('test', 'Test Room', 'file1.txt', 'user1')`
- [ ] Query room_statistics view shows data

---

## 🚀 What's Next

1. **Migrate** database using one of the methods above
2. **Verify** tables exist in Supabase
3. **Rebuild** frontend: `cd void && npm run build`
4. **Test** collaboration feature in VS Code
5. **Check** database has your room data

---

## 📞 Troubleshooting

### "Table already exists" Error
✅ Normal! The migration uses `CREATE TABLE IF NOT EXISTS`
- This means idempotency is working
- Safe to re-run

### "Foreign key violation"
❌ Check that collaboration_rooms table exists first
- Migration creates them in correct order

### Can't see tables in UI
- Refresh browser (Ctrl+Shift+R)
- Check Schema dropdown (should be "public")
- Tables may take a few seconds to appear

### Connection refused
- Verify PROJECT_ID is correct: **fcsmfkwsmlinzxvqlvml**
- Check your Supabase credentials are valid
- Check internet connection

---

## 📊 Project Status After Migration

- ✅ Frontend code: Complete
- ✅ Backend code: Complete
- 🔄 Database schema: Ready to deploy
- ⏳ Next: Run migration using Method 1 above

**Estimated time**: 5 minutes to complete migration
