-- Add groupId column to live_points table
ALTER TABLE live_points
ADD COLUMN group_id VARCHAR REFERENCES groups(id);

-- Drop old unique constraint on (user_id, month_key)
ALTER TABLE live_points
DROP CONSTRAINT IF EXISTS live_points_user_id_month_key_key;

-- Add new unique constraint on (user_id, month_key, group_id)
-- This allows NULL group_id (global) to coexist with group-specific rows
ALTER TABLE live_points
ADD UNIQUE (user_id, month_key, group_id);

-- Create index for faster queries by groupId
CREATE INDEX IF NOT EXISTS idx_live_points_group_month
ON live_points(group_id, month_key);
