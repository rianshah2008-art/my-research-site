import type { GarminVitals } from "@/lib/types";
import { STEPS_GOAL } from "@/lib/types";

/** Row shape stored in public.garmin_vitals (matches Supabase table). */
export interface GarminVitalsRow {
  id?: string;
  user_id?: string | null;
  date: string;
  steps?: number | null;
  step_goal?: number | null;
  resting_heart_rate?: number | null;
  active_calories?: number | null;
  total_calories?: number | null;
  sleep_seconds?: number | null;
  stress_level?: number | null;
  body_battery?: number | null;
  created_at?: string;
  updated_at?: string;
  training_readiness?: number | null;
  training_status?: string | null;
  sleep_score?: number | null;
  hrv_status?: string | null;
  hrv_value?: number | null;
  acute_load?: number | null;
  chronic_load?: number | null;
  load_ratio?: number | null;
  recovery_time_hours?: number | null;
  deep_sleep_min?: number | null;
  rem_sleep_min?: number | null;
  light_sleep_min?: number | null;
  spo2?: number | null;
  respiration_rate?: number | null;
  vo2_max_run?: number | null;
  vo2_max_cycle?: number | null;
  workout_sweat_loss_ml?: number | null;
  run_pace_sec_per_mile?: number | null;
  bike_pace_sec_per_mile?: number | null;
  swim_pace_sec_per_100m?: number | null;
  lactate_threshold_hr?: number | null;
  lactate_threshold_pace_sec?: number | null;
  cycling_ftp_watts?: number | null;
  heat_acclimation_pct?: number | null;
  altitude_acclimation_m?: number | null;
  // Legacy column names (older Apex schema)
  resting_hr?: number | null;
  total_calories_burned?: number | null;
  sleep_duration_min?: number | null;
}

export function defaultGarminUserId(): string {
  return process.env.GARMIN_EMAIL || "default";
}

/** Normalize a DB row (new or legacy columns) into the app GarminVitals shape. */
export function rowToGarminVitals(row: GarminVitalsRow): GarminVitals {
  const sleepSeconds =
    row.sleep_seconds ??
    (row.sleep_duration_min != null ? row.sleep_duration_min * 60 : null);

  return {
    date: row.date,
    training_readiness: row.training_readiness ?? null,
    training_status: row.training_status ?? null,
    sleep_score: row.sleep_score ?? null,
    body_battery: row.body_battery ?? null,
    hrv_status: row.hrv_status ?? null,
    steps: row.steps ?? null,
    resting_hr: row.resting_heart_rate ?? row.resting_hr ?? null,
    active_calories: row.active_calories ?? null,
    total_calories_burned: row.total_calories ?? row.total_calories_burned ?? null,
    acute_load: row.acute_load ?? null,
    chronic_load: row.chronic_load ?? null,
    load_ratio: row.load_ratio ?? null,
    vo2_max_run: row.vo2_max_run ?? null,
    vo2_max_cycle: row.vo2_max_cycle ?? null,
    workout_sweat_loss_ml: row.workout_sweat_loss_ml ?? null,
    spo2: row.spo2 ?? null,
    respiration_rate: row.respiration_rate ?? null,
    stress_level: row.stress_level ?? null,
    sleep_duration_min:
      sleepSeconds != null ? Math.round(sleepSeconds / 60) : null,
    deep_sleep_min: row.deep_sleep_min ?? null,
    rem_sleep_min: row.rem_sleep_min ?? null,
    light_sleep_min: row.light_sleep_min ?? null,
    recovery_time_hours: row.recovery_time_hours ?? null,
    hrv_value: row.hrv_value ?? null,
    run_pace_sec_per_mile: row.run_pace_sec_per_mile ?? null,
    bike_pace_sec_per_mile: row.bike_pace_sec_per_mile ?? null,
    swim_pace_sec_per_100m: row.swim_pace_sec_per_100m ?? null,
    lactate_threshold_hr: row.lactate_threshold_hr ?? null,
    lactate_threshold_pace_sec: row.lactate_threshold_pace_sec ?? null,
    cycling_ftp_watts: row.cycling_ftp_watts ?? null,
    heat_acclimation_pct: row.heat_acclimation_pct ?? null,
    altitude_acclimation_m: row.altitude_acclimation_m ?? null,
  };
}

/** Convert app vitals into a DB upsert payload for public.garmin_vitals. */
export function vitalsToRow(
  vitals: Partial<GarminVitals>,
  userId: string = defaultGarminUserId()
): GarminVitalsRow {
  const sleepSeconds =
    vitals.sleep_duration_min != null
      ? Math.round(vitals.sleep_duration_min * 60)
      : null;

  return {
    user_id: userId,
    date: vitals.date!,
    steps: vitals.steps ?? 0,
    step_goal: STEPS_GOAL,
    resting_heart_rate: vitals.resting_hr ?? null,
    active_calories: vitals.active_calories ?? 0,
    total_calories: vitals.total_calories_burned ?? 0,
    sleep_seconds: sleepSeconds ?? 0,
    stress_level: vitals.stress_level ?? null,
    body_battery: vitals.body_battery ?? null,
    updated_at: new Date().toISOString(),
    training_readiness: vitals.training_readiness ?? null,
    training_status: vitals.training_status ?? null,
    sleep_score: vitals.sleep_score ?? null,
    hrv_status: vitals.hrv_status ?? null,
    hrv_value: vitals.hrv_value ?? null,
    acute_load: vitals.acute_load ?? null,
    chronic_load: vitals.chronic_load ?? null,
    load_ratio: vitals.load_ratio ?? null,
    recovery_time_hours: vitals.recovery_time_hours ?? null,
    deep_sleep_min: vitals.deep_sleep_min ?? null,
    rem_sleep_min: vitals.rem_sleep_min ?? null,
    light_sleep_min: vitals.light_sleep_min ?? null,
    spo2: vitals.spo2 ?? null,
    respiration_rate: vitals.respiration_rate ?? null,
    vo2_max_run: vitals.vo2_max_run ?? null,
    vo2_max_cycle: vitals.vo2_max_cycle ?? null,
    workout_sweat_loss_ml: vitals.workout_sweat_loss_ml ?? 0,
    run_pace_sec_per_mile: vitals.run_pace_sec_per_mile ?? null,
    bike_pace_sec_per_mile: vitals.bike_pace_sec_per_mile ?? null,
    swim_pace_sec_per_100m: vitals.swim_pace_sec_per_100m ?? null,
    lactate_threshold_hr: vitals.lactate_threshold_hr ?? null,
    lactate_threshold_pace_sec: vitals.lactate_threshold_pace_sec ?? null,
    cycling_ftp_watts: vitals.cycling_ftp_watts ?? null,
    heat_acclimation_pct: vitals.heat_acclimation_pct ?? null,
    altitude_acclimation_m: vitals.altitude_acclimation_m ?? null,
  };
}
