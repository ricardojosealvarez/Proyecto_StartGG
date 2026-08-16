BEGIN;

ALTER TABLE tournaments
  ADD COLUMN IF NOT EXISTS country_code TEXT;

CREATE INDEX IF NOT EXISTS tournaments_country_code_idx ON tournaments(country_code);

COMMIT;
