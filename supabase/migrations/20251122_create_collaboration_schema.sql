-- Void Backend Database Schema for Supabase
-- Migration: Create collaboration tables and indexes
-- Created: 2025-11-22

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
-- 5. SAMPLE TRIGGERS
-- ============================================================

-- Auto-update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_collaboration_rooms_updated_at ON collaboration_rooms;
CREATE TRIGGER update_collaboration_rooms_updated_at
BEFORE UPDATE ON collaboration_rooms
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- Migration Complete!
-- ============================================================
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
