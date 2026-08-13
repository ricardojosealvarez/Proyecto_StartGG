BEGIN;

CREATE TABLE IF NOT EXISTS players (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  startgg_player_id TEXT NOT NULL UNIQUE,
  gamer_tag TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS tournaments (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  startgg_tournament_id TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  starts_at TIMESTAMPTZ NOT NULL,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sets (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  startgg_set_id TEXT NOT NULL UNIQUE,
  tournament_id BIGINT NOT NULL REFERENCES tournaments(id),
  videogame_id BIGINT NOT NULL,
  winner_player_id BIGINT NOT NULL REFERENCES players(id),
  loser_player_id BIGINT NOT NULL REFERENCES players(id),
  completed_at TIMESTAMPTZ NOT NULL,
  raw_payload JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT sets_distinct_players CHECK (winner_player_id <> loser_player_id)
);

CREATE TABLE IF NOT EXISTS rating_periods (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  external_key TEXT NOT NULL UNIQUE,
  period_type TEXT NOT NULL CHECK (period_type IN ('tournament', 'week')),
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed')),
  calculated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT rating_period_dates CHECK (ends_at >= starts_at)
);

CREATE TABLE IF NOT EXISTS rating_period_sets (
  rating_period_id BIGINT NOT NULL REFERENCES rating_periods(id) ON DELETE CASCADE,
  set_id BIGINT NOT NULL REFERENCES sets(id) ON DELETE RESTRICT,
  PRIMARY KEY (rating_period_id, set_id)
);

CREATE TABLE IF NOT EXISTS rating_snapshots (
  rating_period_id BIGINT NOT NULL REFERENCES rating_periods(id) ON DELETE CASCADE,
  player_id BIGINT NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  rating DOUBLE PRECISION NOT NULL,
  deviation DOUBLE PRECISION NOT NULL CHECK (deviation > 0),
  volatility DOUBLE PRECISION NOT NULL CHECK (volatility > 0),
  matches_played INTEGER NOT NULL DEFAULT 0 CHECK (matches_played >= 0),
  period_matches INTEGER NOT NULL DEFAULT 0 CHECK (period_matches >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (rating_period_id, player_id)
);

CREATE INDEX IF NOT EXISTS sets_completed_at_idx ON sets(completed_at);
CREATE INDEX IF NOT EXISTS sets_videogame_id_idx ON sets(videogame_id);
CREATE INDEX IF NOT EXISTS rating_snapshots_player_id_idx ON rating_snapshots(player_id);
CREATE INDEX IF NOT EXISTS rating_periods_ends_at_idx ON rating_periods(ends_at);

COMMIT;
