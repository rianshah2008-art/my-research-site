import { format, subDays } from "date-fns";
import {
  GarminVitals,
  NutritionLog,
  HydrationLog,
  WeightLog,
  TrendDataPoint,
} from "./types";

function seededRandom(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 16807 + 0) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

function generateVitalsForDay(daysAgo: number): GarminVitals {
  const rand = seededRandom(daysAgo * 9973 + 42);
  const date = format(subDays(new Date(), daysAgo), "yyyy-MM-dd");
  const statuses = ["Productive", "Maintaining", "Overreaching", "Unproductive"];
  const hrvStatuses = ["Balanced", "Unbalanced"];

  return {
    date,
    training_readiness: Math.round(55 + rand() * 40),
    training_status: statuses[Math.floor(rand() * statuses.length)],
    sleep_score: Math.round(60 + rand() * 35),
    body_battery: Math.round(40 + rand() * 55),
    hrv_status: hrvStatuses[rand() > 0.3 ? 0 : 1],
    steps: Math.round(6000 + rand() * 8000),
    resting_hr: Math.round(48 + rand() * 12),
    active_calories: Math.round(300 + rand() * 600),
    total_calories_burned: Math.round(2200 + rand() * 800),
    acute_load: Math.round(200 + rand() * 400),
    vo2_max_run: Math.round((48 + rand() * 8) * 10) / 10,
    vo2_max_cycle: Math.round((42 + rand() * 6) * 10) / 10,
    workout_sweat_loss_ml: Math.round(rand() * 800),
    spo2: Math.round(95 + rand() * 4),
    respiration_rate: Math.round((12 + rand() * 4) * 10) / 10,
    stress_level: Math.round(20 + rand() * 50),
    sleep_duration_min: Math.round(360 + rand() * 120),
    deep_sleep_min: Math.round(60 + rand() * 60),
    rem_sleep_min: Math.round(70 + rand() * 50),
    light_sleep_min: Math.round(180 + rand() * 80),
    recovery_time_hours: Math.round(rand() * 48),
    hrv_value: Math.round(35 + rand() * 25),
  };
}

export function getDemoVitals(days = 7): GarminVitals[] {
  return Array.from({ length: days }, (_, i) =>
    generateVitalsForDay(days - 1 - i)
  );
}

export function getDemoVitalsToday(): GarminVitals {
  return generateVitalsForDay(0);
}

export function getDemoTrend(
  key: keyof GarminVitals,
  days = 7
): TrendDataPoint[] {
  return getDemoVitals(days).map((v) => ({
    date: v.date,
    value: typeof v[key] === "number" ? (v[key] as number) : 0,
  }));
}

export function getDemoNutritionLogs(): NutritionLog[] {
  const meals = [
    { dish_name: "Chicken & Rice Bowl", calories: 650, protein_g: 45, carbs_g: 72, fat_g: 14 },
    { dish_name: "Greek Yogurt & Berries", calories: 320, protein_g: 28, carbs_g: 35, fat_g: 8 },
    { dish_name: "Protein Shake", calories: 280, protein_g: 40, carbs_g: 12, fat_g: 6 },
  ];
  return meals.map((m, i) => ({
    id: `demo-${i}`,
    date: format(new Date(), "yyyy-MM-dd"),
    image_url: null,
    ...m,
    created_at: new Date().toISOString(),
  }));
}

export function getDemoHydrationToday(): number {
  return 2100;
}

export function getDemoWeight(): number {
  return 135.2;
}

export function getDemoNutritionTrend(days = 7): {
  calories: TrendDataPoint[];
  protein: TrendDataPoint[];
  hydration: TrendDataPoint[];
} {
  const rand = seededRandom(123);
  const calories: TrendDataPoint[] = [];
  const protein: TrendDataPoint[] = [];
  const hydration: TrendDataPoint[] = [];

  for (let i = days - 1; i >= 0; i--) {
    const date = format(subDays(new Date(), i), "yyyy-MM-dd");
    calories.push({ date, value: Math.round(2200 + rand() * 600) });
    protein.push({ date, value: Math.round(110 + rand() * 40) });
    hydration.push({ date, value: Math.round(3000 + rand() * 1500) });
  }

  return { calories, protein, hydration };
}

export function getDemoWeightTrend(days = 7): TrendDataPoint[] {
  const rand = seededRandom(456);
  return Array.from({ length: days }, (_, i) => ({
    date: format(subDays(new Date(), days - 1 - i), "yyyy-MM-dd"),
    value: Math.round((134.5 + i * 0.1 + rand() * 0.3) * 10) / 10,
  }));
}

export type { WeightLog, HydrationLog };
