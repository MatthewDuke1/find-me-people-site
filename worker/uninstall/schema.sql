-- D1 schema for the post-uninstall survey collector.
-- Apply with:
--   wrangler d1 execute fmp-uninstalls --remote --file=./schema.sql

CREATE TABLE IF NOT EXISTS uninstalls (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  reason        TEXT NOT NULL,          -- whitelisted machine value (e.g. "bug")
  reason_label  TEXT,                   -- human label sent by the page
  comment       TEXT,                   -- optional free text, <= 1000 chars
  version       TEXT,                   -- extension version from ?v=
  submitted_at  TEXT NOT NULL           -- ISO-8601, server-stamped
);

CREATE INDEX IF NOT EXISTS idx_uninstalls_reason       ON uninstalls (reason);
CREATE INDEX IF NOT EXISTS idx_uninstalls_submitted_at ON uninstalls (submitted_at);
