#!/usr/bin/env python3
"""
Apex Connect - Garmin Connect Sync Engine

Syncs daily vitals from Garmin Connect to Supabase.
Requires: GARMIN_EMAIL, GARMIN_PASSWORD, NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
"""

import os
import sys
from datetime import date
from typing import Optional

try:
    from garminconnect import Garmin
    from supabase import create_client
except ImportError as e:
    print(f"ERROR: Missing dependency - {e}")
    print("Run: pip install python-garminconnect supabase")
    sys.exit(1)


def estimate_sweat_loss_ml(activity: dict) -> int:
    """Estimate sweat loss from workout duration and intensity."""
    duration_sec = activity.get("duration", 0) or activity.get("elapsedDuration", 0)
    if isinstance(duration_sec, float):
        duration_sec = int(duration_sec)

    duration_min = duration_sec / 60 if duration_sec else 0
    avg_hr = activity.get("averageHR") or activity.get("avgHr") or 120
    activity_type = (activity.get("activityType") or {}).get("typeKey", "other")
    if isinstance(activity.get("activityType"), str):
        activity_type = activity.get("activityType", "other")

    base_rate = 500  # mL per hour baseline
    if activity_type in ("running", "trail_running"):
        base_rate = 800
    elif activity_type in ("cycling", "indoor_cycling", "road_biking"):
        base_rate = 600
    elif activity_type in ("strength_training", "fitness_equipment"):
        base_rate = 400
    elif activity_type in ("lap_swimming", "open_water_swimming", "swimming"):
        base_rate = 300

    hr_multiplier = 1.0 + max(0, (avg_hr - 120) / 100)
    sweat_ml = int((duration_min / 60) * base_rate * hr_multiplier)
    return max(0, sweat_ml)


def _activity_type_key(activity: dict) -> str:
    at = activity.get("activityType")
    if isinstance(at, dict):
        return (at.get("typeKey") or "").lower()
    if isinstance(at, str):
        return at.lower()
    return ""


def _pace_sec_per_mile(activity: dict) -> Optional[float]:
    """Derive mile pace (seconds) from distance & duration."""
    distance_m = activity.get("distance") or 0
    duration_sec = activity.get("duration") or activity.get("elapsedDuration") or 0
    if not distance_m or not duration_sec or distance_m < 100:
        # Fallback: averageSpeed is m/s
        avg_speed = activity.get("averageSpeed")
        if avg_speed and avg_speed > 0:
            return round(1609.344 / avg_speed, 1)
        return None
    miles = distance_m / 1609.344
    if miles <= 0:
        return None
    return round(duration_sec / miles, 1)


def _swim_pace_sec_per_100m(activity: dict) -> Optional[float]:
    distance_m = activity.get("distance") or 0
    duration_sec = activity.get("duration") or activity.get("elapsedDuration") or 0
    if not distance_m or not duration_sec or distance_m < 25:
        avg_speed = activity.get("averageSpeed")
        if avg_speed and avg_speed > 0:
            return round(100 / avg_speed, 1)
        return None
    return round((duration_sec / distance_m) * 100, 1)


def fetch_garmin_data(client: Garmin, today: date) -> dict:
    """Fetch all vitals from Garmin Connect for today."""
    today_str = today.isoformat()
    vitals = {
        "date": today_str,
        "workout_sweat_loss_ml": 0,
    }

    try:
        stats = client.get_stats(today_str)
        if stats:
            vitals["steps"] = stats.get("totalSteps")
            vitals["resting_hr"] = stats.get("restingHeartRate")
            vitals["active_calories"] = stats.get("activeKilocalories")
            vitals["total_calories_burned"] = stats.get("totalKilocalories")
            vitals["stress_level"] = stats.get("averageStressLevel")
            vitals["spo2"] = stats.get("averageSpo2")
            vitals["respiration_rate"] = stats.get("avgWakingRespirationValue")
            vitals["body_battery"] = stats.get("bodyBatteryHighestValue") or stats.get(
                "bodyBatteryMostRecentValue"
            )
    except Exception as e:
        print(f"WARN: Could not fetch stats: {e}")

    try:
        sleep = client.get_sleep_data(today_str)
        if sleep and "dailySleepDTO" in sleep:
            dto = sleep["dailySleepDTO"]
            vitals["sleep_score"] = (
                dto.get("sleepScores", {}).get("overall", {}).get("value")
            )
            vitals["sleep_duration_min"] = (dto.get("sleepTimeSeconds") or 0) // 60
            vitals["deep_sleep_min"] = (dto.get("deepSleepSeconds") or 0) // 60
            vitals["rem_sleep_min"] = (dto.get("remSleepSeconds") or 0) // 60
            vitals["light_sleep_min"] = (dto.get("lightSleepSeconds") or 0) // 60
    except Exception as e:
        print(f"WARN: Could not fetch sleep: {e}")

    try:
        hrv = client.get_hrv_data(today_str)
        if hrv:
            vitals["hrv_status"] = hrv.get("status")
            vitals["hrv_value"] = hrv.get("weeklyAvg")
    except Exception as e:
        print(f"WARN: Could not fetch HRV: {e}")

    try:
        readiness = client.get_training_readiness(today_str)
        if readiness:
            if isinstance(readiness, list) and readiness:
                readiness = readiness[0]
            vitals["training_readiness"] = readiness.get("score")
            vitals["recovery_time_hours"] = readiness.get("recoveryTime")
    except Exception as e:
        print(f"WARN: Could not fetch training readiness: {e}")

    try:
        status = client.get_training_status(today_str)
        if status:
            most_recent = status.get("mostRecentTrainingStatus", {}) or {}
            # Nested payload variations across garminconnect versions
            nested = most_recent.get("latestTrainingStatusData") or most_recent
            vitals["training_status"] = (
                nested.get("trainingStatusFeedbackPhrase")
                or most_recent.get("trainingStatusFeedbackPhrase")
            )

            load_balance = (
                status.get("mostRecentTrainingLoadBalance")
                or nested.get("trainingLoadBalanceDTO")
                or {}
            )
            acute = (
                load_balance.get("acuteTrainingLoad")
                or load_balance.get("dailyTrainingLoadAcute")
                or nested.get("acuteTrainingLoad")
            )
            chronic = (
                load_balance.get("chronicTrainingLoad")
                or load_balance.get("dailyTrainingLoadChronic")
                or nested.get("chronicTrainingLoad")
            )
            if acute is not None:
                vitals["acute_load"] = int(acute)
            if chronic is not None:
                vitals["chronic_load"] = int(chronic)
            if acute is not None and chronic:
                vitals["load_ratio"] = round(float(acute) / float(chronic), 2)
            elif load_balance.get("trainingLoadRatio") is not None:
                vitals["load_ratio"] = float(load_balance.get("trainingLoadRatio"))
    except Exception as e:
        print(f"WARN: Could not fetch training status: {e}")

    try:
        vo2 = client.get_max_metrics(today_str)
        if vo2:
            for metric in vo2 if isinstance(vo2, list) else [vo2]:
                sport = (metric.get("sport") or "").upper()
                if sport == "RUNNING":
                    vitals["vo2_max_run"] = metric.get("vo2MaxValue")
                elif sport == "CYCLING":
                    vitals["vo2_max_cycle"] = metric.get("vo2MaxValue")
    except Exception as e:
        print(f"WARN: Could not fetch VO2 max: {e}")

    # Lactate threshold (HR + pace)
    try:
        if hasattr(client, "get_lactate_threshold"):
            lt = client.get_lactate_threshold()
            if lt:
                vitals["lactate_threshold_hr"] = lt.get("heartRate") or lt.get(
                    "lactateThresholdHeartRate"
                )
                # speed in m/s → sec/mile
                speed = lt.get("speed") or lt.get("lactateThresholdSpeed")
                if speed and speed > 0:
                    vitals["lactate_threshold_pace_sec"] = round(1609.344 / speed, 1)
                elif lt.get("pace"):
                    vitals["lactate_threshold_pace_sec"] = float(lt.get("pace"))
    except Exception as e:
        print(f"WARN: Could not fetch lactate threshold: {e}")

    # Cycling FTP
    try:
        if hasattr(client, "get_ftp"):
            ftp = client.get_ftp()
            if isinstance(ftp, (int, float)):
                vitals["cycling_ftp_watts"] = int(ftp)
            elif isinstance(ftp, dict):
                vitals["cycling_ftp_watts"] = ftp.get("ftp") or ftp.get("value")
    except Exception as e:
        print(f"WARN: Could not fetch FTP: {e}")

    # Heat & altitude acclimation (physiological metrics / training readiness extras)
    try:
        if hasattr(client, "get_physiological_metrics"):
            phys = client.get_physiological_metrics(today_str)
            if phys:
                heat = phys.get("heatAcclimation") or phys.get("heatAltitudeAcclimationDTO") or {}
                if isinstance(heat, dict):
                    vitals["heat_acclimation_pct"] = heat.get("heatAcclimationPercentage") or heat.get(
                        "heatAcclimationPercent"
                    )
                    vitals["altitude_acclimation_m"] = heat.get("altitudeAcclimation") or heat.get(
                        "altitudeAcclimationMeters"
                    )
                elif isinstance(phys.get("heatAcclimationPercentage"), (int, float)):
                    vitals["heat_acclimation_pct"] = phys.get("heatAcclimationPercentage")
                    vitals["altitude_acclimation_m"] = phys.get("altitudeAcclimation")
    except Exception as e:
        print(f"WARN: Could not fetch heat/altitude acclimation: {e}")

    # Also check training readiness payload for acclimation fields
    try:
        readiness = client.get_training_readiness(today_str)
        if readiness:
            if isinstance(readiness, list) and readiness:
                readiness = readiness[0]
            if vitals.get("heat_acclimation_pct") is None and readiness.get("heatAcclimation"):
                vitals["heat_acclimation_pct"] = readiness.get("heatAcclimation")
            if vitals.get("altitude_acclimation_m") is None and readiness.get("altitudeAcclimation"):
                vitals["altitude_acclimation_m"] = readiness.get("altitudeAcclimation")
    except Exception:
        pass

    # Activities → sweat loss + best paces for the day
    try:
        activities = client.get_activities(0, 40)
        total_sweat = 0
        run_paces = []
        bike_paces = []
        swim_paces = []

        for activity in activities or []:
            act_date = (activity.get("startTimeLocal") or "")[:10]
            if act_date != today_str:
                continue

            total_sweat += estimate_sweat_loss_ml(activity)
            key = _activity_type_key(activity)

            if any(k in key for k in ("run", "trail")):
                pace = _pace_sec_per_mile(activity)
                if pace:
                    run_paces.append(pace)
            elif any(k in key for k in ("cycl", "bik", "ride")):
                pace = _pace_sec_per_mile(activity)
                if pace:
                    bike_paces.append(pace)
            elif "swim" in key:
                pace = _swim_pace_sec_per_100m(activity)
                if pace:
                    swim_paces.append(pace)

        vitals["workout_sweat_loss_ml"] = total_sweat
        if run_paces:
            vitals["run_pace_sec_per_mile"] = round(min(run_paces), 1)
        if bike_paces:
            vitals["bike_pace_sec_per_mile"] = round(min(bike_paces), 1)
        if swim_paces:
            vitals["swim_pace_sec_per_100m"] = round(min(swim_paces), 1)
    except Exception as e:
        print(f"WARN: Could not fetch activities: {e}")

    return vitals


def main():
    email = os.environ.get("GARMIN_EMAIL")
    password = os.environ.get("GARMIN_PASSWORD")
    supabase_url = os.environ.get("NEXT_PUBLIC_SUPABASE_URL")
    supabase_key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")

    if not email or not password:
        print("ERROR: GARMIN_EMAIL and GARMIN_PASSWORD required")
        sys.exit(1)

    if not supabase_url or not supabase_key:
        print("ERROR: Supabase credentials required")
        sys.exit(1)

    print(f"Connecting to Garmin Connect as {email}...")
    client = Garmin(email, password)
    client.login()

    today = date.today()
    print(f"Fetching vitals for {today.isoformat()}...")
    vitals = fetch_garmin_data(client, today)

    print(f"Upserting vitals: {vitals}")
    supabase = create_client(supabase_url, supabase_key)
    result = supabase.table("garmin_vitals").upsert(vitals, on_conflict="date").execute()

    print(f"SUCCESS: Synced {len(result.data or [])} record(s) for {today.isoformat()}")
    print(f"Sweat loss today: {vitals.get('workout_sweat_loss_ml', 0)} mL")
    print(
        f"Training load — acute: {vitals.get('acute_load')}, "
        f"chronic: {vitals.get('chronic_load')}, ratio: {vitals.get('load_ratio')}"
    )


if __name__ == "__main__":
    main()
