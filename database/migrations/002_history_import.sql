BEGIN;

ALTER TABLE tournaments
  ADD COLUMN IF NOT EXISTS slug TEXT,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

CREATE TABLE IF NOT EXISTS events (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  startgg_event_id TEXT NOT NULL UNIQUE,
  tournament_id BIGINT NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  videogame_id BIGINT NOT NULL,
  entrant_count INTEGER CHECK (entrant_count IS NULL OR entrant_count >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE sets
  ADD COLUMN IF NOT EXISTS event_id BIGINT REFERENCES events(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

ALTER TABLE rating_periods
  ADD COLUMN IF NOT EXISTS source_tournament_id BIGINT REFERENCES tournaments(id) ON DELETE CASCADE;

CREATE UNIQUE INDEX IF NOT EXISTS rating_periods_source_tournament_id_idx
  ON rating_periods(source_tournament_id)
  WHERE source_tournament_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS events_tournament_id_idx ON events(tournament_id);
CREATE INDEX IF NOT EXISTS sets_event_id_idx ON sets(event_id);

COMMIT;
