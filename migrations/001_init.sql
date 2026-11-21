CREATE TABLE IF NOT EXISTS journals (
  owner_hash TEXT PRIMARY KEY,
  data JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS journals_updated_at_idx ON journals (updated_at);
