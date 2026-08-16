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

const IDENTITY_COLUMNS = new Set(["id", "user_id", "date", "created_at"]);

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
  row: GarminVitalsRow | Record<string, unknown>,
  allowed: Iterable<string>
): Record<string, unknown> {
  const allow = new Set(allowed);
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(row)) {
    if (allow.has(key) && value !== undefined) out[key] = value;
  }
  if ("date" in row && row.date) out.date = row.date;
  if ("user_id" in row && row.user_id !== undefined) out.user_id = row.user_id;
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

function isMissingColumnError(message: string): boolean {
  return MISSING_COLUMN_RE.test(message) || /schema cache/i.test(message);
}

function isConflictTargetError(message: string): boolean {
  return /no unique|ON CONFLICT|conflict|unique constraint|there is no unique or exclusion constraint/i.test(
    message
  );
}

/**
 * Split a full vitals row into:
 * - known/allowed table columns
 * - extras that should live in raw_data JSONB when columns are missing
 */
export function splitCoreAndRawData(
  fullRow: Record<string, unknown>,
  knownColumns: Set<string>
): {
  tablePayload: Record<string, unknown>;
  rawData: Record<string, unknown>;
} {
  const tablePayload: Record<string, unknown> = {};
  const rawData: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(fullRow)) {
    if (value === undefined) continue;
    if (key === "raw_data") continue;
    if (knownColumns.has(key)) {
      tablePayload[key] = value;
    } else {
      rawData[key] = value;
    }
  }

  // Always keep identity fields on the table row
  if (fullRow.date) tablePayload.date = fullRow.date;
  if (fullRow.user_id !== undefined) tablePayload.user_id = fullRow.user_id;

  if (Object.keys(rawData).length > 0 && knownColumns.has("raw_data")) {
    tablePayload.raw_data = rawData;
  }

  return { tablePayload, rawData };
}

export interface UpsertGarminResult {
  success: boolean;
  strippedColumns: string[];
  usedRawData: boolean;
  onConflict: string;
  payload: Record<string, unknown>;
  error?: string;
}

async function attemptUpsert(
  supabase: SupabaseClient,
  payload: Record<string, unknown>,
  onConflict: "user_id,date" | "id"
) {
  return supabase.from("garmin_vitals").upsert(payload, { onConflict });
}

/**
 * Upsert garmin_vitals with explicit onConflict and raw_data fallback:
 * 1) Upsert with onConflict: 'user_id,date' (fallback 'id')
 * 2) On missing-column errors, move unknown/extra fields into raw_data JSONB
 * 3) Retry with core columns + raw_data so sync always succeeds when possible
 */
export async function upsertGarminVitals(
  supabase: SupabaseClient,
  row: GarminVitalsRow
): Promise<UpsertGarminResult> {
  const discovered = await discoverGarminVitalsColumns();
  const fullRow = stripUndefined(row as unknown as Record<string, unknown>);

  // Prefer discovered schema; otherwise assume core + extended (+ raw_data)
  const knownColumns =
    discovered && discovered.size > 0
      ? new Set(discovered)
      : new Set<string>([
          ...GARMIN_CORE_COLUMNS,
          ...GARMIN_EXTENDED_COLUMNS,
          "raw_data",
          "id",
        ]);

  const split = splitCoreAndRawData(fullRow, knownColumns);
  let rawData = split.rawData;
  let payload = stripUndefined(split.tablePayload);
  const strippedColumns: string[] = [];
  let usedRawData = Object.keys(rawData).length > 0 && "raw_data" in payload;

  const conflictTargets: Array<"user_id,date" | "id"> = ["user_id,date", "id"];

  for (const onConflict of conflictTargets) {
    // Skip id conflict if we don't have an id to upsert on
    if (onConflict === "id" && !payload.id) continue;

    let attempts = 0;
    while (attempts < 40) {
      attempts += 1;

      const { error } = await attemptUpsert(supabase, payload, onConflict);

      if (!error) {
        if (discovered) {
          for (const key of Object.keys(payload)) discovered.add(key);
        }
        return {
          success: true,
          strippedColumns,
          usedRawData,
          onConflict,
          payload,
        };
      }

      // Missing column → peel it off into raw_data and retry
      if (isMissingColumnError(error.message)) {
        const missing = extractMissingColumn(error.message);

        if (missing === "raw_data") {
          // Table has no raw_data yet — drop extras, keep lean core write
          delete payload.raw_data;
          usedRawData = false;
          if (missing) {
            strippedColumns.push(...Object.keys(rawData));
            rawData = {};
          }
          // Also strip any non-core keys still on the payload
          const coreOnly = pickColumns(
            { ...fullRow, ...payload },
            GARMIN_CORE_COLUMNS
          );
          payload = stripUndefined(coreOnly);
          continue;
        }

        if (missing && missing in payload) {
          // Move this field into raw_data bucket
          if (!IDENTITY_COLUMNS.has(missing) && missing !== "updated_at") {
            rawData[missing] = payload[missing];
            strippedColumns.push(missing);
          }
          delete payload[missing];
          knownColumns.delete(missing);
          if (discovered) discovered.delete(missing);

          // Attach raw_data if the column exists (or we haven't proven otherwise)
          if (Object.keys(rawData).length > 0) {
            payload.raw_data = { ...rawData };
            usedRawData = true;
          }
          continue;
        }

        // Generic missing-column / schema-cache error without a clear name:
        // collapse to core columns + raw_data JSON blob of everything else
        const corePayload = stripUndefined(
          pickColumns(fullRow, GARMIN_CORE_COLUMNS)
        );
        const extras: Record<string, unknown> = {};
        for (const [key, value] of Object.entries(fullRow)) {
          if (
            value === undefined ||
            key === "raw_data" ||
            GARMIN_CORE_COLUMNS.includes(
              key as (typeof GARMIN_CORE_COLUMNS)[number]
            ) ||
            IDENTITY_COLUMNS.has(key)
          ) {
            continue;
          }
          extras[key] = value;
          if (!strippedColumns.includes(key)) strippedColumns.push(key);
        }

        payload = { ...corePayload };
        if (Object.keys(extras).length > 0) {
          payload.raw_data = extras;
          usedRawData = true;
          rawData = extras;
        }
        continue;
      }

      // Wrong conflict target — try next (user_id,date → id)
      if (isConflictTargetError(error.message)) {
        break;
      }

      return {
        success: false,
        strippedColumns,
        usedRawData,
        onConflict,
        payload,
        error: error.message,
      };
    }
  }

  // Final guaranteed attempt: absolute lean core (no raw_data) so sync can succeed
  const finalCore = stripUndefined(pickColumns(fullRow, GARMIN_CORE_COLUMNS));
  const { error: finalError } = await attemptUpsert(
    supabase,
    finalCore,
    "user_id,date"
  );

  if (!finalError) {
    return {
      success: true,
      strippedColumns: [
        ...strippedColumns,
        ...Object.keys(fullRow).filter(
          (k) =>
            !(GARMIN_CORE_COLUMNS as readonly string[]).includes(k) &&
            !IDENTITY_COLUMNS.has(k) &&
            k !== "raw_data"
        ),
      ],
      usedRawData: false,
      onConflict: "user_id,date",
      payload: finalCore,
    };
  }

  // Last resort: conflict on id if present
  if (fullRow.id) {
    const { error: idError } = await attemptUpsert(
      supabase,
      { ...finalCore, id: fullRow.id },
      "id"
    );
    if (!idError) {
      return {
        success: true,
        strippedColumns,
        usedRawData: false,
        onConflict: "id",
        payload: { ...finalCore, id: fullRow.id },
      };
    }
  }

  return {
    success: false,
    strippedColumns,
    usedRawData,
    onConflict: "user_id,date",
    payload: finalCore,
    error:
      finalError.message ||
      "Failed to upsert garmin_vitals after raw_data fallback",
  };
}
