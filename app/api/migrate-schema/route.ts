import { NextResponse } from "next/server";
import {
  applyGarminMigrationViaManagementApi,
  reloadPostgrestSchema,
} from "@/lib/supabase-migrate";
import { invalidateGarminColumnCache } from "@/lib/garmin-upsert";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/migrate-schema
 * Applies supabase/migrate_garmin_vitals.sql via the Supabase Management API.
 * Requires SUPABASE_ACCESS_TOKEN (and optional SUPABASE_PROJECT_REF).
 */
export async function POST() {
  try {
    const result = await applyGarminMigrationViaManagementApi();
    if (result.success) {
      await reloadPostgrestSchema();
      invalidateGarminColumnCache();
    }
    return NextResponse.json(result, {
      status: result.success || result.skipped ? 200 : 500,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Migration failed";
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}
