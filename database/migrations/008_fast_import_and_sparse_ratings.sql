BEGIN;

CREATE TABLE IF NOT EXISTS startgg_api_rate_limits (
  token_hash TEXT PRIMARY KEY,
  next_request_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS history_import_progress (
  scope_key TEXT PRIMARY KEY,
  tournament_page INTEGER NOT NULL CHECK (tournament_page >= 1),
  tournament_index INTEGER NOT NULL CHECK (tournament_index >= 0),
  status TEXT NOT NULL CHECK (status IN ('running', 'completed')),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

ALTER TABLE rating_periods
  ADD COLUMN IF NOT EXISTS snapshot_mode TEXT NOT NULL DEFAULT 'dense'
    CHECK (snapshot_mode IN ('dense', 'sparse')),
  ADD COLUMN IF NOT EXISTS calculation_id UUID;

CREATE TABLE IF NOT EXISTS rating_checkpoints (
  rating_period_id BIGINT NOT NULL REFERENCES rating_periods(id) ON DELETE CASCADE,
  player_id BIGINT NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  calculation_id UUID NOT NULL,
  rating DOUBLE PRECISION NOT NULL,
  deviation DOUBLE PRECISION NOT NULL CHECK (deviation > 0),
  volatility DOUBLE PRECISION NOT NULL CHECK (volatility > 0),
  matches_played INTEGER NOT NULL CHECK (matches_played >= 0),
  period_matches INTEGER NOT NULL CHECK (period_matches >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (rating_period_id, player_id, calculation_id)
);

CREATE INDEX IF NOT EXISTS rating_checkpoints_player_period_idx
  ON rating_checkpoints (player_id, rating_period_id);

CREATE INDEX IF NOT EXISTS rating_periods_completed_order_idx
  ON rating_periods (status, starts_at, id);

COMMIT;
