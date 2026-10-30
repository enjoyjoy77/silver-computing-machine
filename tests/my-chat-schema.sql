CREATE TABLE IF NOT EXISTS my_chat_sessions (
  id TEXT PRIMARY KEY,
  expires INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS my_chat_sessions_expiry ON my_chat_sessions(expires);
CREATE TABLE IF NOT EXISTS my_chat_attempts (
  id TEXT NOT NULL,
  bucket INTEGER NOT NULL,
  count INTEGER NOT NULL,
  PRIMARY KEY (id, bucket)
);
