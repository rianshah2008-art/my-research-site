-- Upgrade an existing lean garmin_vitals table (the CREATE you already ran)
-- to the full Apex Connect column set. Safe to re-run.

ALTER TABLE public.garmin_vitals ADD COLUMN IF NOT EXISTS training_readiness INT8;
ALTER TABLE public.garmin_vitals ADD COLUMN IF NOT EXISTS training_status TEXT;
ALTER TABLE public.garmin_vitals ADD COLUMN IF NOT EXISTS sleep_score INT8;
ALTER TABLE public.garmin_vitals ADD COLUMN IF NOT EXISTS hrv_status TEXT;
ALTER TABLE public.garmin_vitals ADD COLUMN IF NOT EXISTS hrv_value FLOAT8;
ALTER TABLE public.garmin_vitals ADD COLUMN IF NOT EXISTS acute_load INT8;
ALTER TABLE public.garmin_vitals ADD COLUMN IF NOT EXISTS chronic_load INT8;
ALTER TABLE public.garmin_vitals ADD COLUMN IF NOT EXISTS load_ratio FLOAT8;
ALTER TABLE public.garmin_vitals ADD COLUMN IF NOT EXISTS recovery_time_hours INT8;
ALTER TABLE public.garmin_vitals ADD COLUMN IF NOT EXISTS deep_sleep_min INT8;
ALTER TABLE public.garmin_vitals ADD COLUMN IF NOT EXISTS rem_sleep_min INT8;
ALTER TABLE public.garmin_vitals ADD COLUMN IF NOT EXISTS light_sleep_min INT8;
ALTER TABLE public.garmin_vitals ADD COLUMN IF NOT EXISTS spo2 INT8;
ALTER TABLE public.garmin_vitals ADD COLUMN IF NOT EXISTS respiration_rate FLOAT8;
ALTER TABLE public.garmin_vitals ADD COLUMN IF NOT EXISTS vo2_max_run FLOAT8;
ALTER TABLE public.garmin_vitals ADD COLUMN IF NOT EXISTS vo2_max_cycle FLOAT8;
ALTER TABLE public.garmin_vitals ADD COLUMN IF NOT EXISTS workout_sweat_loss_ml INT8 DEFAULT 0;
ALTER TABLE public.garmin_vitals ADD COLUMN IF NOT EXISTS run_pace_sec_per_mile FLOAT8;
ALTER TABLE public.garmin_vitals ADD COLUMN IF NOT EXISTS bike_pace_sec_per_mile FLOAT8;
ALTER TABLE public.garmin_vitals ADD COLUMN IF NOT EXISTS swim_pace_sec_per_100m FLOAT8;
ALTER TABLE public.garmin_vitals ADD COLUMN IF NOT EXISTS lactate_threshold_hr INT8;
ALTER TABLE public.garmin_vitals ADD COLUMN IF NOT EXISTS lactate_threshold_pace_sec FLOAT8;
ALTER TABLE public.garmin_vitals ADD COLUMN IF NOT EXISTS cycling_ftp_watts INT8;
ALTER TABLE public.garmin_vitals ADD COLUMN IF NOT EXISTS heat_acclimation_pct INT8;
ALTER TABLE public.garmin_vitals ADD COLUMN IF NOT EXISTS altitude_acclimation_m INT8;

CREATE INDEX IF NOT EXISTS idx_garmin_vitals_date ON public.garmin_vitals(date DESC);

-- Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';
