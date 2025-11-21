-- octate Backend Database Schema for Supabase
-- This file contains all tables needed for the collaboration system
-- Run this entire file in Supabase SQL Editor

-- ============================================================
-- 1. COLLABORATION ROOMS TABLE
-- ============================================================
-- Stores active collaboration rooms where users edit together

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

-- Indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_rooms_room_id ON collaboration_rooms(room_id);
CREATE INDEX IF NOT EXISTS idx_rooms_created_at ON collaboration_rooms(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_rooms_file_id ON collaboration_rooms(file_id);

-- ============================================================
-- 2. OPERATIONS TABLE
-- ============================================================
-- Stores individual edit operations for operational transformation

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

-- Indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_operations_room_id ON operations(room_id);
CREATE INDEX IF NOT EXISTS idx_operations_user_id ON operations(user_id);
CREATE INDEX IF NOT EXISTS idx_operations_created_at ON operations(created_at);
CREATE INDEX IF NOT EXISTS idx_operations_version ON operations(version);

-- ============================================================
-- 3. ROOM PARTICIPANTS TABLE
-- ============================================================
-- Tracks users actively participating in collaboration rooms

CREATE TABLE IF NOT EXISTS room_participants (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  room_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  user_name TEXT NOT NULL,
  joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  active BOOLEAN DEFAULT TRUE,
  FOREIGN KEY (room_id) REFERENCES collaboration_rooms(room_id) ON DELETE CASCADE
);

-- Indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_participants_room_id ON room_participants(room_id);
CREATE INDEX IF NOT EXISTS idx_participants_user_id ON room_participants(user_id);
CREATE INDEX IF NOT EXISTS idx_participants_active ON room_participants(active);

-- ============================================================
-- 4. CREATE VIEWS (Optional but useful)
-- ============================================================

-- View for getting room info with participant count
CREATE OR REPLACE VIEW room_statistics AS
SELECT
  r.room_id,
  r.name,
  r.file_id,
  r.host,
  r.version,
  COUNT(DISTINCT p.user_id) as participant_count,
  COUNT(DISTINCT o.id) as operation_count,
  r.created_at,
  r.updated_at
FROM collaboration_rooms r
LEFT JOIN room_participants p ON r.room_id = p.room_id AND p.active = TRUE
LEFT JOIN operations o ON r.room_id = o.room_id
GROUP BY r.room_id, r.name, r.file_id, r.host, r.version, r.created_at, r.updated_at;

-- ============================================================
-- 5. ENABLE ROW LEVEL SECURITY (Optional)
-- ============================================================
-- Uncomment these if you want to enable RLS for security

-- ALTER TABLE collaboration_rooms ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE operations ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE room_participants ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 6. SAMPLE TRIGGERS (Optional)
-- ============================================================

-- Auto-update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_collaboration_rooms_updated_at
BEFORE UPDATE ON collaboration_rooms
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- 7. SAMPLE DATA (Optional - for testing)
-- ============================================================
-- Uncomment to add test data

-- INSERT INTO collaboration_rooms (room_id, name, file_id, host, content, version)
-- VALUES (
--   'room-test-001',
--   'Test Room',
--   'file-001',
--   'user-host-001',
--   '// Hello World\nconsole.log("Testing");',
--   1
-- );

-- INSERT INTO room_participants (room_id, user_id, user_name, active)
-- VALUES (
--   'room-test-001',
--   'user-001',
--   'Alice',
--   TRUE
-- );

-- INSERT INTO operations (room_id, operation_id, user_id, data, version)
-- VALUES (
--   'room-test-001',
--   'op-001',
--   'user-001',
--   '{"type": "insert", "position": 0, "content": "// Hello World"}'::jsonb,
--   0
-- );

-- ============================================================
-- 8. VERIFICATION QUERIES (Run to verify setup)
-- ============================================================

-- Check if tables exist
-- SELECT table_name FROM information_schema.tables
-- WHERE table_schema = 'public'
-- AND table_name IN ('collaboration_rooms', 'operations', 'room_participants');

-- Check table structure
-- \d collaboration_rooms
-- \d operations
-- \d room_participants

-- Check indexes
-- SELECT * FROM pg_indexes WHERE tablename IN ('collaboration_rooms', 'operations', 'room_participants');

-- ============================================================
-- Schema Setup Complete!
-- ============================================================
--
-- Tables created:
-- ✓ collaboration_rooms - Main rooms for collaboration
-- ✓ operations - Edit operations for OT
-- ✓ room_participants - Active participants
--
-- Views created:
-- ✓ room_statistics - Room info with counts
--
-- Triggers created:
-- ✓ update_collaboration_rooms_updated_at - Auto timestamp update
--
-- Ready to use with the backend!
