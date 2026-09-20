BEGIN;

ALTER TABLE tournaments
  ADD COLUMN IF NOT EXISTS startgg_url TEXT,
  ADD COLUMN IF NOT EXISTS tier_points INTEGER,
  ADD COLUMN IF NOT EXISTS tier TEXT;

ALTER TABLE tournaments
  DROP CONSTRAINT IF EXISTS tournaments_tier_points_non_negative;

ALTER TABLE tournaments
  ADD CONSTRAINT tournaments_tier_points_non_negative
  CHECK (tier_points IS NULL OR tier_points >= 0);

COMMIT;
