-- Create pending_notifications table
CREATE TABLE pending_notifications (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  group_id VARCHAR REFERENCES groups(id) ON DELETE SET NULL,
  notification_type VARCHAR NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  data JSONB,
  created_at TIMESTAMP DEFAULT NOW(),
  is_delivered BOOLEAN DEFAULT FALSE,
  delivered_at TIMESTAMP
);

CREATE INDEX idx_pending_notifications_user_delivered
ON pending_notifications(user_id, is_delivered);

CREATE INDEX idx_pending_notifications_group
ON pending_notifications(group_id);

-- Create push_subscriptions table
CREATE TABLE push_subscriptions (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL,
  auth_key TEXT NOT NULL,
  p256dh_key TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, endpoint)
);

CREATE INDEX idx_push_subscriptions_user
ON push_subscriptions(user_id);

-- Create last_month_rankings table to track ranking changes
CREATE TABLE last_month_rankings (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  month_key VARCHAR NOT NULL,
  group_id VARCHAR REFERENCES groups(id) ON DELETE CASCADE,
  user_id VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  rank INT,
  points REAL,
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(month_key, group_id, user_id)
);

CREATE INDEX idx_last_rankings_month_group
ON last_month_rankings(month_key, group_id);
