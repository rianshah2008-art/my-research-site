-- Apex Connect Database Schema
-- Run this migration in your Supabase SQL editor

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Garmin daily vitals synced from Garmin Connect
CREATE TABLE IF NOT EXISTS garmin_vitals (
  date DATE PRIMARY KEY,
  training_readiness INT,
  training_status TEXT,
  sleep_score INT,
  body_battery INT,
  hrv_status TEXT,
  steps INT,
  resting_hr INT,
  active_calories INT,
  total_calories_burned INT,
  acute_load INT,
  vo2_max_run FLOAT,
  vo2_max_cycle FLOAT,
  workout_sweat_loss_ml INT DEFAULT 0,
  -- Extended fields for Daily Vitals & Recovery pages
  spo2 INT,
  respiration_rate FLOAT,
  stress_level INT,
  sleep_duration_min INT,
  deep_sleep_min INT,
  rem_sleep_min INT,
  light_sleep_min INT,
  recovery_time_hours INT,
  hrv_value FLOAT
);

-- AI-analyzed nutrition logs from meal photos
CREATE TABLE IF NOT EXISTS nutrition_logs (
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

-- Body weight tracking
CREATE TABLE IF NOT EXISTS weight_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date DATE DEFAULT CURRENT_DATE,
  weight_lbs FLOAT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Hydration intake tracking
CREATE TABLE IF NOT EXISTS hydration_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date DATE DEFAULT CURRENT_DATE,
  amount_ml INT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for 7-day trend queries
CREATE INDEX IF NOT EXISTS idx_nutrition_logs_date ON nutrition_logs(date DESC);
CREATE INDEX IF NOT EXISTS idx_weight_logs_date ON weight_logs(date DESC);
CREATE INDEX IF NOT EXISTS idx_hydration_logs_date ON hydration_logs(date DESC);

-- Row Level Security (enable for production)
ALTER TABLE garmin_vitals ENABLE ROW LEVEL SECURITY;
ALTER TABLE nutrition_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE weight_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE hydration_logs ENABLE ROW LEVEL SECURITY;

-- Permissive policies for authenticated users (adjust for your auth setup)
CREATE POLICY "Allow all for garmin_vitals" ON garmin_vitals FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for nutrition_logs" ON nutrition_logs FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for weight_logs" ON weight_logs FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for hydration_logs" ON hydration_logs FOR ALL USING (true) WITH CHECK (true);
