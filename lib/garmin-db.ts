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
  /** Overflow bag for fields that don't exist as concrete columns yet */
  raw_data?: Record<string, unknown> | null;
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
  const raw = (row.raw_data || {}) as Record<string, unknown>;
  const merged = { ...raw, ...row } as GarminVitalsRow & Record<string, unknown>;

  const sleepSeconds =
    (merged.sleep_seconds as number | null | undefined) ??
    (merged.sleep_duration_min != null
      ? (merged.sleep_duration_min as number) * 60
      : null);

  const num = (v: unknown): number | null =>
    typeof v === "number" && Number.isFinite(v) ? v : null;
  const str = (v: unknown): string | null =>
    typeof v === "string" && v.length > 0 ? v : null;

  return {
    date: String(merged.date),
    training_readiness: num(merged.training_readiness),
    training_status: str(merged.training_status),
    sleep_score: num(merged.sleep_score),
    body_battery: num(merged.body_battery),
    hrv_status: str(merged.hrv_status),
    steps: num(merged.steps),
    resting_hr:
      num(merged.resting_heart_rate) ?? num(merged.resting_hr),
    active_calories: num(merged.active_calories),
    total_calories_burned:
      num(merged.total_calories) ?? num(merged.total_calories_burned),
    acute_load: num(merged.acute_load),
    chronic_load: num(merged.chronic_load),
    load_ratio: num(merged.load_ratio),
    vo2_max_run: num(merged.vo2_max_run),
    vo2_max_cycle: num(merged.vo2_max_cycle),
    workout_sweat_loss_ml: num(merged.workout_sweat_loss_ml),
    spo2: num(merged.spo2),
    respiration_rate: num(merged.respiration_rate),
    stress_level: num(merged.stress_level),
    sleep_duration_min:
      sleepSeconds != null ? Math.round(Number(sleepSeconds) / 60) : null,
    deep_sleep_min: num(merged.deep_sleep_min),
    rem_sleep_min: num(merged.rem_sleep_min),
    light_sleep_min: num(merged.light_sleep_min),
    recovery_time_hours: num(merged.recovery_time_hours),
    hrv_value: num(merged.hrv_value),
    run_pace_sec_per_mile: num(merged.run_pace_sec_per_mile),
    bike_pace_sec_per_mile: num(merged.bike_pace_sec_per_mile),
    swim_pace_sec_per_100m: num(merged.swim_pace_sec_per_100m),
    lactate_threshold_hr: num(merged.lactate_threshold_hr),
    lactate_threshold_pace_sec: num(merged.lactate_threshold_pace_sec),
    cycling_ftp_watts: num(merged.cycling_ftp_watts),
    heat_acclimation_pct: num(merged.heat_acclimation_pct),
    altitude_acclimation_m: num(merged.altitude_acclimation_m),
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
