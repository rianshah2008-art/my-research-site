import { format, subDays } from "date-fns";
import { GarminConnect } from "garmin-connect";
import { getSupabase, isSupabaseConfigured } from "@/lib/supabase";
import { vitalsToRow } from "@/lib/garmin-db";
import { upsertGarminVitals, invalidateGarminColumnCache } from "@/lib/garmin-upsert";
import {
  applyGarminMigrationViaManagementApi,
  reloadPostgrestSchema,
} from "@/lib/supabase-migrate";
import type { GarminVitals } from "@/lib/types";

const GC_API = "https://connectapi.garmin.com";

type AnyRecord = Record<string, unknown>;

function asRecord(value: unknown): AnyRecord | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as AnyRecord)
    : null;
}

function asNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "" && !Number.isNaN(Number(value))) {
    return Number(value);
  }
  return null;
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function activityTypeKey(activity: AnyRecord): string {
  const at = activity.activityType;
  if (at && typeof at === "object" && !Array.isArray(at)) {
    return String((at as AnyRecord).typeKey || "").toLowerCase();
  }
  if (typeof at === "string") return at.toLowerCase();
  return "";
}

function estimateSweatLossMl(activity: AnyRecord): number {
  const durationSec =
    asNumber(activity.duration) || asNumber(activity.elapsedDuration) || 0;
  const durationMin = durationSec / 60;
  const avgHr = asNumber(activity.averageHR) || asNumber(activity.avgHr) || 120;
  const key = activityTypeKey(activity);

  let baseRate = 500;
  if (key.includes("run") || key.includes("trail")) baseRate = 800;
  else if (key.includes("cycl") || key.includes("bik") || key.includes("ride"))
    baseRate = 600;
  else if (key.includes("strength") || key.includes("fitness")) baseRate = 400;
  else if (key.includes("swim")) baseRate = 300;

  const hrMultiplier = 1.0 + Math.max(0, (avgHr - 120) / 100);
  return Math.max(0, Math.round((durationMin / 60) * baseRate * hrMultiplier));
}

function paceSecPerMile(activity: AnyRecord): number | null {
  const distanceM = asNumber(activity.distance) || 0;
  const durationSec =
    asNumber(activity.duration) || asNumber(activity.elapsedDuration) || 0;

  if (!distanceM || !durationSec || distanceM < 100) {
    const avgSpeed = asNumber(activity.averageSpeed);
    if (avgSpeed && avgSpeed > 0) return Math.round((1609.344 / avgSpeed) * 10) / 10;
    return null;
  }

  const miles = distanceM / 1609.344;
  if (miles <= 0) return null;
  return Math.round((durationSec / miles) * 10) / 10;
}

function swimPaceSecPer100m(activity: AnyRecord): number | null {
  const distanceM = asNumber(activity.distance) || 0;
  const durationSec =
    asNumber(activity.duration) || asNumber(activity.elapsedDuration) || 0;

  if (!distanceM || !durationSec || distanceM < 25) {
    const avgSpeed = asNumber(activity.averageSpeed);
    if (avgSpeed && avgSpeed > 0) return Math.round((100 / avgSpeed) * 10) / 10;
    return null;
  }

  return Math.round(((durationSec / distanceM) * 100) * 10) / 10;
}

async function safeGet<T = unknown>(
  client: GarminConnect,
  url: string,
  config?: unknown
): Promise<T | null> {
  try {
    return (await client.get(url, config)) as T;
  } catch (error) {
    console.warn(`Garmin GET failed (${url}):`, error);
    return null;
  }
}

function emptyVitals(date: string): Partial<GarminVitals> {
  return {
    date,
    workout_sweat_loss_ml: 0,
  };
}

export async function fetchGarminVitalsForDate(
  client: GarminConnect,
  dateStr: string
): Promise<Partial<GarminVitals>> {
  const vitals = emptyVitals(dateStr);
  const warnings: string[] = [];

  // Daily user summary (steps, calories, stress, SpO2, body battery, etc.)
  const summary =
    (await safeGet<AnyRecord>(
      client,
      `${GC_API}/usersummary-service/usersummary/daily/${dateStr}`
    )) ||
    (await safeGet<AnyRecord>(
      client,
      `${GC_API}/usersummary-service/usersummary/daily`,
      { params: { calendarDate: dateStr } }
    ));

  if (summary) {
    vitals.steps = asNumber(summary.totalSteps);
    vitals.resting_hr = asNumber(summary.restingHeartRate);
    vitals.active_calories = asNumber(summary.activeKilocalories);
    vitals.total_calories_burned = asNumber(summary.totalKilocalories);
    vitals.stress_level = asNumber(summary.averageStressLevel);
    vitals.spo2 = asNumber(summary.averageSpo2) ?? asNumber(summary.averageSPO2);
    vitals.respiration_rate = asNumber(summary.avgWakingRespirationValue);
    vitals.body_battery =
      asNumber(summary.bodyBatteryHighestValue) ??
      asNumber(summary.bodyBatteryMostRecentValue);
  } else {
    // Fallback to built-in helpers
    try {
      vitals.steps = await client.getSteps(new Date(`${dateStr}T12:00:00`));
    } catch {
      warnings.push("steps");
    }
    try {
      const hr = asRecord(await client.getHeartRate(new Date(`${dateStr}T12:00:00`)));
      if (hr) vitals.resting_hr = asNumber(hr.restingHeartRate);
    } catch {
      warnings.push("heartRate");
    }
  }

  // Sleep
  try {
    const sleep = asRecord(
      await client.getSleepData(new Date(`${dateStr}T12:00:00`))
    );
    const dto = asRecord(sleep?.dailySleepDTO);
    if (dto) {
      const scores = asRecord(dto.sleepScores);
      const overall = asRecord(scores?.overall);
      vitals.sleep_score = asNumber(overall?.value);
      vitals.sleep_duration_min = Math.floor(
        (asNumber(dto.sleepTimeSeconds) || 0) / 60
      );
      vitals.deep_sleep_min = Math.floor((asNumber(dto.deepSleepSeconds) || 0) / 60);
      vitals.rem_sleep_min = Math.floor((asNumber(dto.remSleepSeconds) || 0) / 60);
      vitals.light_sleep_min = Math.floor(
        (asNumber(dto.lightSleepSeconds) || 0) / 60
      );
      if (vitals.respiration_rate == null) {
        vitals.respiration_rate = asNumber(dto.averageRespirationValue);
      }
    }
  } catch {
    warnings.push("sleep");
  }

  // HRV
  const hrv =
    (await safeGet<AnyRecord>(client, `${GC_API}/hrv-service/hrv/${dateStr}`)) ||
    (await safeGet<AnyRecord>(
      client,
      `${GC_API}/hrv-service/hrv/daily/${dateStr}/${dateStr}`
    ));
  if (hrv) {
    const summaryHrv = asRecord(hrv.hrvSummary) || hrv;
    vitals.hrv_status =
      asString(summaryHrv.status) || asString(summaryHrv.hrvStatus);
    vitals.hrv_value =
      asNumber(summaryHrv.weeklyAvg) ||
      asNumber(summaryHrv.lastNightAvg) ||
      asNumber(summaryHrv.hrvValue);
  }

  // Training readiness
  let readiness = await safeGet<unknown>(
    client,
    `${GC_API}/metrics-service/metrics/trainingreadiness/${dateStr}`
  );
  if (Array.isArray(readiness) && readiness.length > 0) readiness = readiness[0];
  const readinessObj = asRecord(readiness);
  if (readinessObj) {
    vitals.training_readiness = asNumber(readinessObj.score);
    vitals.recovery_time_hours = asNumber(readinessObj.recoveryTime);
    vitals.heat_acclimation_pct =
      asNumber(readinessObj.heatAcclimation) ??
      asNumber(readinessObj.heatAcclimationPercentage);
    vitals.altitude_acclimation_m =
      asNumber(readinessObj.altitudeAcclimation) ??
      asNumber(readinessObj.altitudeAcclimationMeters);
  }

  // Training status + load
  const status = await safeGet<AnyRecord>(
    client,
    `${GC_API}/metrics-service/metrics/trainingstatus/aggregated/${dateStr}`
  );
  if (status) {
    const mostRecent = asRecord(status.mostRecentTrainingStatus) || {};
    const nested =
      asRecord(mostRecent.latestTrainingStatusData) || mostRecent;
    vitals.training_status =
      asString(nested.trainingStatusFeedbackPhrase) ||
      asString(mostRecent.trainingStatusFeedbackPhrase);

    const loadBalance =
      asRecord(status.mostRecentTrainingLoadBalance) ||
      asRecord(nested.trainingLoadBalanceDTO) ||
      {};

    const acute =
      asNumber(loadBalance.acuteTrainingLoad) ??
      asNumber(loadBalance.dailyTrainingLoadAcute) ??
      asNumber(nested.acuteTrainingLoad);
    const chronic =
      asNumber(loadBalance.chronicTrainingLoad) ??
      asNumber(loadBalance.dailyTrainingLoadChronic) ??
      asNumber(nested.chronicTrainingLoad);

    if (acute != null) vitals.acute_load = Math.round(acute);
    if (chronic != null) vitals.chronic_load = Math.round(chronic);
    if (acute != null && chronic) {
      vitals.load_ratio = Math.round((acute / chronic) * 100) / 100;
    } else {
      const ratio = asNumber(loadBalance.trainingLoadRatio);
      if (ratio != null) vitals.load_ratio = ratio;
    }
  }

  // VO2 max / max metrics
  const vo2 = await safeGet<unknown>(
    client,
    `${GC_API}/metrics-service/metrics/maxmet/latest`
  );
  const vo2List = Array.isArray(vo2)
    ? vo2
    : asRecord(vo2)?.metrics
      ? (asRecord(vo2)?.metrics as unknown[])
      : vo2
        ? [vo2]
        : [];
  for (const metric of vo2List) {
    const m = asRecord(metric);
    if (!m) continue;
    const sport = String(m.sport || "").toUpperCase();
    if (sport === "RUNNING") vitals.vo2_max_run = asNumber(m.vo2MaxValue);
    if (sport === "CYCLING") vitals.vo2_max_cycle = asNumber(m.vo2MaxValue);
  }

  // Lactate threshold
  const lt =
    (await safeGet<AnyRecord>(
      client,
      `${GC_API}/metrics-service/metrics/lactatethreshold`
    )) ||
    (await safeGet<AnyRecord>(
      client,
      `${GC_API}/biometric-service/biometric/latestLactateThreshold`
    ));
  if (lt) {
    vitals.lactate_threshold_hr =
      asNumber(lt.heartRate) ?? asNumber(lt.lactateThresholdHeartRate);
    const speed = asNumber(lt.speed) ?? asNumber(lt.lactateThresholdSpeed);
    if (speed && speed > 0) {
      vitals.lactate_threshold_pace_sec =
        Math.round((1609.344 / speed) * 10) / 10;
    } else {
      const pace = asNumber(lt.pace);
      if (pace != null) vitals.lactate_threshold_pace_sec = pace;
    }
  }

  // Cycling FTP
  const ftpPayload =
    (await safeGet<unknown>(
      client,
      `${GC_API}/fitnessstats-service/activity/ftp`
    )) ||
    (await safeGet<unknown>(
      client,
      `${GC_API}/userprofile-service/userprofile/functional-threshold-power`
    ));
  if (typeof ftpPayload === "number") {
    vitals.cycling_ftp_watts = Math.round(ftpPayload);
  } else {
    const ftpObj = asRecord(ftpPayload);
    const ftp =
      asNumber(ftpObj?.ftp) ??
      asNumber(ftpObj?.value) ??
      asNumber(ftpObj?.functionalThresholdPower);
    if (ftp != null) vitals.cycling_ftp_watts = Math.round(ftp);
  }

  // Heat / altitude acclimation (if not already from readiness)
  if (vitals.heat_acclimation_pct == null || vitals.altitude_acclimation_m == null) {
    const phys =
      (await safeGet<AnyRecord>(
        client,
        `${GC_API}/metrics-service/metrics/heatandalitudeacclimation/${dateStr}`
      )) ||
      (await safeGet<AnyRecord>(
        client,
        `${GC_API}/metrics-service/metrics/heatAndAltitudeAcclimation/${dateStr}`
      ));
    if (phys) {
      const heat =
        asRecord(phys.heatAcclimation) ||
        asRecord(phys.heatAltitudeAcclimationDTO) ||
        phys;
      if (vitals.heat_acclimation_pct == null) {
        vitals.heat_acclimation_pct =
          asNumber(heat.heatAcclimationPercentage) ??
          asNumber(heat.heatAcclimationPercent) ??
          asNumber(heat.heatAcclimation);
      }
      if (vitals.altitude_acclimation_m == null) {
        vitals.altitude_acclimation_m =
          asNumber(heat.altitudeAcclimation) ??
          asNumber(heat.altitudeAcclimationMeters);
      }
    }
  }

  // Activities → sweat loss + best paces
  try {
    const activities = (await client.getActivities(0, 40)) as unknown as AnyRecord[];
    let totalSweat = 0;
    const runPaces: number[] = [];
    const bikePaces: number[] = [];
    const swimPaces: number[] = [];

    for (const activity of activities || []) {
      const actDate = String(activity.startTimeLocal || "").slice(0, 10);
      if (actDate !== dateStr) continue;

      totalSweat += estimateSweatLossMl(activity);
      const key = activityTypeKey(activity);

      if (key.includes("run") || key.includes("trail")) {
        const pace = paceSecPerMile(activity);
        if (pace) runPaces.push(pace);
      } else if (key.includes("cycl") || key.includes("bik") || key.includes("ride")) {
        const pace = paceSecPerMile(activity);
        if (pace) bikePaces.push(pace);
      } else if (key.includes("swim")) {
        const pace = swimPaceSecPer100m(activity);
        if (pace) swimPaces.push(pace);
      }
    }

    vitals.workout_sweat_loss_ml = totalSweat;
    if (runPaces.length) vitals.run_pace_sec_per_mile = Math.min(...runPaces);
    if (bikePaces.length) vitals.bike_pace_sec_per_mile = Math.min(...bikePaces);
    if (swimPaces.length) vitals.swim_pace_sec_per_100m = Math.min(...swimPaces);
  } catch {
    warnings.push("activities");
  }

  if (warnings.length) {
    console.warn("Garmin sync partial warnings:", warnings.join(", "));
  }

  return vitals;
}

export async function syncGarminToSupabase(): Promise<{
  success: boolean;
  message: string;
  vitals?: Partial<GarminVitals>;
  demo?: boolean;
  strippedColumns?: string[];
  migration?: string;
}> {
  const email = process.env.GARMIN_EMAIL;
  const password = process.env.GARMIN_PASSWORD;

  if (!email || !password) {
    return {
      success: false,
      message:
        "Garmin credentials not configured. Set GARMIN_EMAIL and GARMIN_PASSWORD.",
      demo: true,
    };
  }

  if (!isSupabaseConfigured()) {
    return {
      success: false,
      message:
        "Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and a Supabase key.",
    };
  }

  const supabase = getSupabase();
  if (!supabase) {
    return { success: false, message: "Failed to initialize Supabase client." };
  }

  // Best-effort: apply missing columns via Management API when token is present
  let migrationMessage: string | undefined;
  try {
    const migration = await applyGarminMigrationViaManagementApi();
    migrationMessage = migration.message;
    if (migration.success) {
      await reloadPostgrestSchema();
      invalidateGarminColumnCache();
    }
  } catch (error) {
    migrationMessage =
      error instanceof Error
        ? `Auto-migration skipped: ${error.message}`
        : "Auto-migration skipped";
  }

  const client = new GarminConnect({ username: email, password });
  await client.login();

  const today = format(new Date(), "yyyy-MM-dd");
  const vitals = await fetchGarminVitalsForDate(client, today);
  const row = vitalsToRow(vitals, email);

  const upsert = await upsertGarminVitals(supabase, row);
  if (!upsert.success) {
    throw new Error(
      `Supabase upsert failed: ${upsert.error}${
        upsert.strippedColumns.length
          ? ` (stripped: ${upsert.strippedColumns.join(", ")})`
          : ""
      }`
    );
  }

  const details: string[] = [];
  if (upsert.usedRawData) details.push("extras stored in raw_data");
  if (upsert.strippedColumns.length > 0) {
    details.push(`overflow: ${upsert.strippedColumns.join(", ")}`);
  }
  const detailNote = details.length ? ` (${details.join("; ")})` : "";

  return {
    success: true,
    message: `Garmin data synced for ${today}${detailNote}`,
    vitals,
    strippedColumns: upsert.strippedColumns,
    migration: migrationMessage,
  };
}

/** Optional: backfill last N days (used for local/admin tooling). */
export async function syncGarminLastNDays(days = 7): Promise<Partial<GarminVitals>[]> {
  const email = process.env.GARMIN_EMAIL;
  const password = process.env.GARMIN_PASSWORD;
  if (!email || !password) throw new Error("Missing Garmin credentials");

  const client = new GarminConnect({ username: email, password });
  await client.login();

  const supabase = getSupabase();
  const results: Partial<GarminVitals>[] = [];

  for (let i = days - 1; i >= 0; i--) {
    const dateStr = format(subDays(new Date(), i), "yyyy-MM-dd");
    const vitals = await fetchGarminVitalsForDate(client, dateStr);
    results.push(vitals);
    if (supabase) {
      await upsertGarminVitals(supabase, vitalsToRow(vitals, email));
    }
  }

  return results;
}
