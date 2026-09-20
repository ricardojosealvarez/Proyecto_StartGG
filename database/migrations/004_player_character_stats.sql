BEGIN;

CREATE TABLE IF NOT EXISTS player_character_stats (
  player_id TEXT NOT NULL,
  videogame_id TEXT NOT NULL,
  lookback_months INTEGER NOT NULL CHECK (lookback_months >= 0),
  stats JSONB NOT NULL,
  calculated_at TIMESTAMPTZ NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  PRIMARY KEY (player_id, videogame_id, lookback_months)
);

CREATE INDEX IF NOT EXISTS player_character_stats_expires_at_idx
  ON player_character_stats(expires_at);

COMMIT;
