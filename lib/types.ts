export interface GarminVitals {
  date: string;
  training_readiness: number | null;
  training_status: string | null;
  sleep_score: number | null;
  body_battery: number | null;
  hrv_status: string | null;
  steps: number | null;
  resting_hr: number | null;
  active_calories: number | null;
  total_calories_burned: number | null;
  acute_load: number | null;
  vo2_max_run: number | null;
  vo2_max_cycle: number | null;
  workout_sweat_loss_ml: number | null;
  spo2: number | null;
  respiration_rate: number | null;
  stress_level: number | null;
  sleep_duration_min: number | null;
  deep_sleep_min: number | null;
  rem_sleep_min: number | null;
  light_sleep_min: number | null;
  recovery_time_hours: number | null;
  hrv_value: number | null;
}

export interface NutritionLog {
  id: string;
  date: string;
  image_url: string | null;
  dish_name: string | null;
  calories: number | null;
  protein_g: number | null;
  carbs_g: number | null;
  fat_g: number | null;
  created_at: string;
}

export interface WeightLog {
  id: string;
  date: string;
  weight_lbs: number | null;
  created_at: string;
}

export interface HydrationLog {
  id: string;
  date: string;
  amount_ml: number | null;
  created_at: string;
}

export interface TrendDataPoint {
  date: string;
  value: number;
  label?: string;
}

export interface FoodAnalysis {
  dish_name: string;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
}

export type MetricKey =
  | "steps"
  | "resting_hr"
  | "active_calories"
  | "total_calories_burned"
  | "spo2"
  | "respiration_rate"
  | "stress_level"
  | "training_readiness"
  | "training_status"
  | "body_battery"
  | "hrv_value"
  | "sleep_score"
  | "acute_load"
  | "recovery_time_hours"
  | "calories"
  | "protein_g"
  | "hydration_ml"
  | "weight_lbs";

export const LEAN_BULK_CALORIES = 2600;
export const LEAN_BULK_PROTEIN = 140;
export const BASE_WEIGHT_LBS = 135;
export const HYDRATION_ML_PER_LB = 30;
export const STEPS_GOAL = 10000;
