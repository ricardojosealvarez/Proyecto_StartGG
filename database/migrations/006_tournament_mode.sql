BEGIN;

ALTER TABLE tournaments
  ADD COLUMN IF NOT EXISTS is_online BOOLEAN;

CREATE INDEX IF NOT EXISTS tournaments_is_online_idx ON tournaments(is_online);

COMMIT;
