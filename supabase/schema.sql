-- Apex Connect Database Schema
-- Run this migration in your Supabase SQL editor

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ---------------------------------------------------------------------------
-- garmin_vitals
-- Base shape matches the production table (id + user_id + unique_user_date),
-- with Apex Connect metric columns for Daily Vitals / Recovery / Training.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.garmin_vitals (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id TEXT,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  steps INT8 DEFAULT 0,
  step_goal INT8 DEFAULT 10000,
  resting_heart_rate INT8,
  active_calories INT8 DEFAULT 0,
  total_calories INT8 DEFAULT 0,
  sleep_seconds INT8 DEFAULT 0,
  stress_level INT8,
  body_battery INT8,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  -- Recovery & readiness
  training_readiness INT8,
  training_status TEXT,
  sleep_score INT8,
  hrv_status TEXT,
  hrv_value FLOAT8,
  acute_load INT8,
  chronic_load INT8,
  load_ratio FLOAT8,
  recovery_time_hours INT8,
  deep_sleep_min INT8,
  rem_sleep_min INT8,
  light_sleep_min INT8,
  -- Daily vitals extras
  spo2 INT8,
  respiration_rate FLOAT8,
  -- Training performance
  vo2_max_run FLOAT8,
  vo2_max_cycle FLOAT8,
  workout_sweat_loss_ml INT8 DEFAULT 0,
  run_pace_sec_per_mile FLOAT8,
  bike_pace_sec_per_mile FLOAT8,
  swim_pace_sec_per_100m FLOAT8,
  lactate_threshold_hr INT8,
  lactate_threshold_pace_sec FLOAT8,
  cycling_ftp_watts INT8,
  heat_acclimation_pct INT8,
  altitude_acclimation_m INT8,
  CONSTRAINT unique_user_date UNIQUE (user_id, date)
);

-- If the lean base table already exists, add Apex columns safely
ALTER TABLE public.garmin_vitals ADD COLUMN IF NOT EXISTS id UUID DEFAULT gen_random_uuid();
ALTER TABLE public.garmin_vitals ADD COLUMN IF NOT EXISTS user_id TEXT;
ALTER TABLE public.garmin_vitals ADD COLUMN IF NOT EXISTS step_goal INT8 DEFAULT 10000;
ALTER TABLE public.garmin_vitals ADD COLUMN IF NOT EXISTS resting_heart_rate INT8;
ALTER TABLE public.garmin_vitals ADD COLUMN IF NOT EXISTS total_calories INT8 DEFAULT 0;
ALTER TABLE public.garmin_vitals ADD COLUMN IF NOT EXISTS sleep_seconds INT8 DEFAULT 0;
ALTER TABLE public.garmin_vitals ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE public.garmin_vitals ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
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

-- Backfill renamed columns from older Apex schema names (if present)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'garmin_vitals' AND column_name = 'resting_hr'
  ) THEN
    EXECUTE 'UPDATE public.garmin_vitals SET resting_heart_rate = resting_hr WHERE resting_heart_rate IS NULL';
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'garmin_vitals' AND column_name = 'total_calories_burned'
  ) THEN
    EXECUTE 'UPDATE public.garmin_vitals SET total_calories = total_calories_burned WHERE total_calories IS NULL OR total_calories = 0';
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'garmin_vitals' AND column_name = 'sleep_duration_min'
  ) THEN
    EXECUTE 'UPDATE public.garmin_vitals SET sleep_seconds = sleep_duration_min * 60 WHERE (sleep_seconds IS NULL OR sleep_seconds = 0) AND sleep_duration_min IS NOT NULL';
  END IF;
END $$;

-- Ensure unique (user_id, date) for upserts
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'unique_user_date'
  ) THEN
    ALTER TABLE public.garmin_vitals
      ADD CONSTRAINT unique_user_date UNIQUE (user_id, date);
  END IF;
EXCEPTION
  WHEN others THEN
    RAISE NOTICE 'unique_user_date constraint not added: %', SQLERRM;
END $$;

CREATE INDEX IF NOT EXISTS idx_garmin_vitals_date ON public.garmin_vitals(date DESC);

-- Nutrition / weight / hydration
CREATE TABLE IF NOT EXISTS public.nutrition_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date DATE DEFAULT CURRENT_DATE,
  image_url TEXT,
  dish_name TEXT,
  calories INT,
  protein_g INT,
  carbs_g INT,
  fat_g INT,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.weight_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date DATE DEFAULT CURRENT_DATE,
  weight_lbs FLOAT,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.hydration_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date DATE DEFAULT CURRENT_DATE,
  amount_ml INT,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_nutrition_logs_date ON public.nutrition_logs(date DESC);
CREATE INDEX IF NOT EXISTS idx_weight_logs_date ON public.weight_logs(date DESC);
CREATE INDEX IF NOT EXISTS idx_hydration_logs_date ON public.hydration_logs(date DESC);

ALTER TABLE public.garmin_vitals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nutrition_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.weight_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hydration_logs ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'garmin_vitals' AND policyname = 'Allow all for garmin_vitals'
  ) THEN
    CREATE POLICY "Allow all for garmin_vitals" ON public.garmin_vitals FOR ALL USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'nutrition_logs' AND policyname = 'Allow all for nutrition_logs'
  ) THEN
    CREATE POLICY "Allow all for nutrition_logs" ON public.nutrition_logs FOR ALL USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'weight_logs' AND policyname = 'Allow all for weight_logs'
  ) THEN
    CREATE POLICY "Allow all for weight_logs" ON public.weight_logs FOR ALL USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'hydration_logs' AND policyname = 'Allow all for hydration_logs'
  ) THEN
    CREATE POLICY "Allow all for hydration_logs" ON public.hydration_logs FOR ALL USING (true) WITH CHECK (true);
  END IF;
END $$;

-- Reload the API schema cache so PostgREST recognizes the changes immediately
NOTIFY pgrst, 'reload schema';
