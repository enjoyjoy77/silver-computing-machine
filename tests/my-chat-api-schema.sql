-- Add to the existing my-chat-auth D1 database. Contains no credentials.
CREATE TABLE IF NOT EXISTS my_chat_api_control (
  id TEXT PRIMARY KEY,
  bucket INTEGER NOT NULL,
  count INTEGER NOT NULL
);
