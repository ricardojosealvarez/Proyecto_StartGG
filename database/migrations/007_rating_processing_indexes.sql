BEGIN;

CREATE INDEX IF NOT EXISTS rating_periods_pending_order_idx
  ON rating_periods (status, starts_at, id);

CREATE INDEX IF NOT EXISTS rating_snapshots_period_player_idx
  ON rating_snapshots (rating_period_id, player_id);

CREATE INDEX IF NOT EXISTS rating_snapshots_player_period_idx
  ON rating_snapshots (player_id, rating_period_id);

CREATE INDEX IF NOT EXISTS rating_period_sets_period_set_idx
  ON rating_period_sets (rating_period_id, set_id);

COMMIT;
