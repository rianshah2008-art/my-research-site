import { NextResponse } from "next/server";
import { syncGarminToSupabase } from "@/lib/garmin-sync";

export const runtime = "nodejs";
export const maxDuration = 60;
export const dynamic = "force-dynamic";

export async function POST() {
  try {
    const result = await syncGarminToSupabase();
    return NextResponse.json(result, {
      status: result.success || result.demo ? 200 : 500,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Garmin sync failed";
    console.error("Garmin sync error:", message);
    return NextResponse.json(
      { success: false, message: `Garmin sync failed: ${message}` },
      { status: 500 }
    );
  }
}
