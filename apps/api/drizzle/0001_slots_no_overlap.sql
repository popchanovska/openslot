-- No two slots may overlap in time. Half-open ranges ([)) let back-to-back slots touch:
-- 16:00–16:30 and 16:30–17:00 are fine, 16:00–16:30 and 16:15–16:45 are rejected (SQLSTATE 23P01).
ALTER TABLE "slots"
  ADD CONSTRAINT "slots_no_overlap"
  EXCLUDE USING gist (tstzrange("start_at", "end_at", '[)') WITH &&);
