import { NextResponse } from "next/server";
import { getSupabase, isSupabaseConfigured } from "@/lib/supabase";
import { getDemoVitals } from "@/lib/demo-data";
import { rowToGarminVitals, type GarminVitalsRow } from "@/lib/garmin-db";
import { format, subDays } from "date-fns";

export const dynamic = "force-dynamic";

export async function GET() {
  const startDate = format(subDays(new Date(), 6), "yyyy-MM-dd");

  if (!isSupabaseConfigured()) {
    return NextResponse.json(getDemoVitals(7));
  }

  const supabase = getSupabase();
  if (!supabase) {
    return NextResponse.json(getDemoVitals(7));
  }

  const { data, error } = await supabase
    .from("garmin_vitals")
    .select("*")
    .gte("date", startDate)
    .order("date", { ascending: true });

  if (error) {
    console.error("garmin_vitals query error:", error.message);
    return NextResponse.json(getDemoVitals(7));
  }

  if (!data || data.length === 0) {
    return NextResponse.json(getDemoVitals(7));
  }

  return NextResponse.json(
    (data as GarminVitalsRow[]).map(rowToGarminVitals)
  );
}
