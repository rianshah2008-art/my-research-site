import type { SupabaseClient } from "@supabase/supabase-js";
import type { GarminVitalsRow } from "@/lib/garmin-db";

/** Columns present on the lean garmin_vitals CREATE the user already ran. */
export const GARMIN_CORE_COLUMNS = [
  "user_id",
  "date",
  "steps",
  "step_goal",
  "resting_heart_rate",
  "active_calories",
  "total_calories",
  "sleep_seconds",
  "stress_level",
  "body_battery",
  "updated_at",
] as const;

/** Full Apex column set we prefer to write when the table has them. */
export const GARMIN_EXTENDED_COLUMNS = [
  "training_readiness",
  "training_status",
  "sleep_score",
  "hrv_status",
  "hrv_value",
  "acute_load",
  "chronic_load",
  "load_ratio",
  "recovery_time_hours",
  "deep_sleep_min",
  "rem_sleep_min",
  "light_sleep_min",
  "spo2",
  "respiration_rate",
  "vo2_max_run",
  "vo2_max_cycle",
  "workout_sweat_loss_ml",
  "run_pace_sec_per_mile",
  "bike_pace_sec_per_mile",
  "swim_pace_sec_per_100m",
  "lactate_threshold_hr",
  "lactate_threshold_pace_sec",
  "cycling_ftp_watts",
  "heat_acclimation_pct",
  "altitude_acclimation_m",
] as const;

const MISSING_COLUMN_RE =
  /Could not find the '([^']+)' column|column ["'`]?([a-zA-Z0-9_]+)["'`]? (?:does not exist|of relation)|PGRST204/i;

let cachedColumns: Set<string> | null = null;
let cacheFetchedAt = 0;
const CACHE_TTL_MS = 5 * 60 * 1000;

function stripUndefined(
  row: Record<string, unknown>
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(row)) {
    if (value !== undefined) out[key] = value;
  }
  return out;
}

export function pickColumns(
  row: GarminVitalsRow,
  allowed: Iterable<string>
): Record<string, unknown> {
  const allow = new Set(allowed);
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(row)) {
    if (allow.has(key) && value !== undefined) out[key] = value;
  }
  // date + user_id are required for the unique constraint
  if (row.date) out.date = row.date;
  if (row.user_id !== undefined) out.user_id = row.user_id;
  return out;
}

/** Discover garmin_vitals columns from PostgREST OpenAPI (best-effort). */
export async function discoverGarminVitalsColumns(
  force = false
): Promise<Set<string> | null> {
  if (
    !force &&
    cachedColumns &&
    Date.now() - cacheFetchedAt < CACHE_TTL_MS
  ) {
    return cachedColumns;
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;

  try {
    const res = await fetch(`${url}/rest/v1/`, {
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        Accept: "application/openapi+json",
      },
      cache: "no-store",
    });
    if (!res.ok) return null;

    const spec = (await res.json()) as {
      definitions?: Record<string, { properties?: Record<string, unknown> }>;
      components?: {
        schemas?: Record<string, { properties?: Record<string, unknown> }>;
      };
    };

    const props =
      spec.definitions?.garmin_vitals?.properties ||
      spec.components?.schemas?.garmin_vitals?.properties;

    if (!props) return null;

    cachedColumns = new Set(Object.keys(props));
    cacheFetchedAt = Date.now();
    return cachedColumns;
  } catch (error) {
    console.warn("Failed to discover garmin_vitals columns:", error);
    return null;
  }
}

export function invalidateGarminColumnCache() {
  cachedColumns = null;
  cacheFetchedAt = 0;
}

function extractMissingColumn(message: string): string | null {
  const match = message.match(MISSING_COLUMN_RE);
  if (!match) return null;
  return match[1] || match[2] || null;
}

export interface UpsertGarminResult {
  success: boolean;
  strippedColumns: string[];
  payload: Record<string, unknown>;
  error?: string;
}

/**
 * Upsert garmin_vitals with payload sanitization:
 * 1) Prefer OpenAPI-discovered columns when available
 * 2) On missing-column / PGRST204 errors, strip the offending key and retry
 * 3) Fall back across conflict targets (user_id,date) → date
 */
export async function upsertGarminVitals(
  supabase: SupabaseClient,
  row: GarminVitalsRow
): Promise<UpsertGarminResult> {
  const discovered = await discoverGarminVitalsColumns();
  const preferred =
    discovered && discovered.size > 0
      ? discovered
      : new Set<string>([...GARMIN_CORE_COLUMNS, ...GARMIN_EXTENDED_COLUMNS]);

  let payload = stripUndefined(pickColumns(row, preferred));
  const strippedColumns: string[] = [];

  const conflictTargets = ["user_id,date", "date"] as const;

  for (const onConflict of conflictTargets) {
    let attempts = 0;
    while (attempts < 50) {
      attempts += 1;
      const { error } = await supabase
        .from("garmin_vitals")
        .upsert(payload, { onConflict });

      if (!error) {
        if (discovered) {
          // Keep cache warm with columns we successfully wrote
          for (const key of Object.keys(payload)) discovered.add(key);
        }
        return { success: true, strippedColumns, payload };
      }

      const missing = extractMissingColumn(error.message);
      if (missing && missing in payload) {
        delete payload[missing];
        strippedColumns.push(missing);
        if (discovered) discovered.delete(missing);
        continue;
      }

      // Conflict target mismatch — try next strategy
      const conflictIssue =
        /no unique|ON CONFLICT|conflict|unique constraint/i.test(
          error.message
        );
      if (conflictIssue) break;

      // Unknown schema error — last resort: lean core-only payload
      if (attempts === 1) {
        payload = stripUndefined(pickColumns(row, GARMIN_CORE_COLUMNS));
        continue;
      }

      return {
        success: false,
        strippedColumns,
        payload,
        error: error.message,
      };
    }
  }

  return {
    success: false,
    strippedColumns,
    payload,
    error:
      "Failed to upsert garmin_vitals after sanitizing payload and conflict targets",
  };
}
