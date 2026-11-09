-- Run with a dedicated PostgreSQL role; these tables must never be exposed via a public API.
CREATE TABLE IF NOT EXISTS chaveflow_state (
  id integer PRIMARY KEY CHECK (id = 1),
  data jsonb NOT NULL
);
CREATE TABLE IF NOT EXISTS chaveflow_files (
  storage_key text PRIMARY KEY,
  content bytea NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS chaveflow_rate_limits (
  key_hash text PRIMARY KEY,
  attempts integer NOT NULL DEFAULT 1,
  expires_at timestamptz NOT NULL
);
ALTER TABLE chaveflow_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE chaveflow_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE chaveflow_rate_limits ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON chaveflow_state, chaveflow_files, chaveflow_rate_limits FROM PUBLIC;
