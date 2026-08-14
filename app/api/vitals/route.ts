import { NextResponse } from "next/server";
import { getSupabase, isSupabaseConfigured } from "@/lib/supabase";
import { getDemoVitals } from "@/lib/demo-data";
import { format, subDays } from "date-fns";
import { GarminVitals } from "@/lib/types";

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

  if (error || !data || data.length === 0) {
    return NextResponse.json(getDemoVitals(7));
  }

  return NextResponse.json(data as GarminVitals[]);
}
