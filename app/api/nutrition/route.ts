import { NextResponse } from "next/server";
import { getSupabase, isSupabaseConfigured } from "@/lib/supabase";
import {
  getDemoNutritionLogs,
  getDemoNutritionTrend,
  getDemoHydrationToday,
  getDemoWeight,
} from "@/lib/demo-data";
import { format, subDays } from "date-fns";

export async function GET() {
  const startDate = format(subDays(new Date(), 6), "yyyy-MM-dd");
  const today = format(new Date(), "yyyy-MM-dd");

  if (!isSupabaseConfigured()) {
    const trend = getDemoNutritionTrend(7);
    const logs = getDemoNutritionLogs();
    const totalCalories = logs.reduce((s, l) => s + (l.calories || 0), 0);
    const totalProtein = logs.reduce((s, l) => s + (l.protein_g || 0), 0);

    return NextResponse.json({
      logs,
      todayCalories: totalCalories,
      todayProtein: totalProtein,
      todayHydration: getDemoHydrationToday(),
      currentWeight: getDemoWeight(),
      trend,
    });
  }

  const supabase = getSupabase();
  if (!supabase) {
    const trend = getDemoNutritionTrend(7);
    return NextResponse.json({
      logs: getDemoNutritionLogs(),
      todayCalories: 1250,
      todayProtein: 113,
      todayHydration: getDemoHydrationToday(),
      currentWeight: getDemoWeight(),
      trend,
    });
  }

  const [nutritionRes, hydrationRes, weightRes] = await Promise.all([
    supabase
      .from("nutrition_logs")
      .select("*")
      .gte("date", startDate)
      .order("created_at", { ascending: false }),
    supabase
      .from("hydration_logs")
      .select("*")
      .gte("date", startDate),
    supabase
      .from("weight_logs")
      .select("*")
      .order("date", { ascending: false })
      .limit(1),
  ]);

  const logs = nutritionRes.data || [];
  const todayLogs = logs.filter((l) => l.date === today);
  const todayCalories = todayLogs.reduce(
    (s, l) => s + (l.calories || 0),
    0
  );
  const todayProtein = todayLogs.reduce(
    (s, l) => s + (l.protein_g || 0),
    0
  );

  const hydrationLogs = hydrationRes.data || [];
  const todayHydration = hydrationLogs
    .filter((h) => h.date === today)
    .reduce((s, h) => s + (h.amount_ml || 0), 0);

  const currentWeight = weightRes.data?.[0]?.weight_lbs ?? 135;

  const days = Array.from({ length: 7 }, (_, i) =>
    format(subDays(new Date(), 6 - i), "yyyy-MM-dd")
  );

  const trend = {
    calories: days.map((date) => ({
      date,
      value: logs
        .filter((l) => l.date === date)
        .reduce((s, l) => s + (l.calories || 0), 0),
    })),
    protein: days.map((date) => ({
      date,
      value: logs
        .filter((l) => l.date === date)
        .reduce((s, l) => s + (l.protein_g || 0), 0),
    })),
    hydration: days.map((date) => ({
      date,
      value: hydrationLogs
        .filter((h) => h.date === date)
        .reduce((s, h) => s + (h.amount_ml || 0), 0),
    })),
  };

  return NextResponse.json({
    logs: todayLogs,
    todayCalories,
    todayProtein,
    todayHydration,
    currentWeight,
    trend,
  });
}

export async function POST(request: Request) {
  const body = await request.json();
  const { type } = body;

  if (!isSupabaseConfigured()) {
    return NextResponse.json({ success: true, demo: true });
  }

  const supabase = getSupabase();
  if (!supabase) {
    return NextResponse.json({ error: "Database unavailable" }, { status: 503 });
  }

  const today = format(new Date(), "yyyy-MM-dd");

  if (type === "hydration") {
    const { amount_ml } = body;
    const { error } = await supabase
      .from("hydration_logs")
      .insert({ date: today, amount_ml });
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ success: true });
  }

  if (type === "weight") {
    const { weight_lbs } = body;
    const { error } = await supabase
      .from("weight_logs")
      .insert({ date: today, weight_lbs });
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ success: true });
  }

  if (type === "nutrition") {
    const { dish_name, calories, protein_g, carbs_g, fat_g, image_url } =
      body;
    const { error } = await supabase.from("nutrition_logs").insert({
      date: today,
      dish_name,
      calories,
      protein_g,
      carbs_g,
      fat_g,
      image_url,
    });
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ error: "Unknown type" }, { status: 400 });
}
