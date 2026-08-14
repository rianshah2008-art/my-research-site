#!/usr/bin/env python3
"""
Apex Connect - Garmin Connect Sync Engine

Syncs daily vitals from Garmin Connect to Supabase.
Requires: GARMIN_EMAIL, GARMIN_PASSWORD, NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
"""

import os
import sys
from datetime import date, datetime

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

    base_rate = 500  # mL per hour baseline
    if activity_type in ("running", "trail_running"):
        base_rate = 800
    elif activity_type in ("cycling", "indoor_cycling"):
        base_rate = 600
    elif activity_type in ("strength_training", "fitness_equipment"):
        base_rate = 400

    hr_multiplier = 1.0 + max(0, (avg_hr - 120) / 100)
    sweat_ml = int((duration_min / 60) * base_rate * hr_multiplier)
    return max(0, sweat_ml)


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
            vitals["body_battery"] = stats.get("bodyBatteryHighestValue") or stats.get("bodyBatteryMostRecentValue")
    except Exception as e:
        print(f"WARN: Could not fetch stats: {e}")

    try:
        sleep = client.get_sleep_data(today_str)
        if sleep and "dailySleepDTO" in sleep:
            dto = sleep["dailySleepDTO"]
            vitals["sleep_score"] = dto.get("sleepScores", {}).get("overall", {}).get("value")
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
            vitals["training_readiness"] = readiness.get("score")
    except Exception as e:
        print(f"WARN: Could not fetch training readiness: {e}")

    try:
        status = client.get_training_status(today_str)
        if status:
            most_recent = status.get("mostRecentTrainingStatus", {})
            vitals["training_status"] = most_recent.get("trainingStatusFeedbackPhrase")
            load_balance = status.get("mostRecentTrainingLoadBalance", {})
            vitals["acute_load"] = load_balance.get("acuteTrainingLoad")
    except Exception as e:
        print(f"WARN: Could not fetch training status: {e}")

    try:
        vo2 = client.get_max_metrics(today_str)
        if vo2:
            for metric in vo2 if isinstance(vo2, list) else [vo2]:
                if metric.get("sport") == "RUNNING":
                    vitals["vo2_max_run"] = metric.get("vo2MaxValue")
                elif metric.get("sport") == "CYCLING":
                    vitals["vo2_max_cycle"] = metric.get("vo2MaxValue")
    except Exception as e:
        print(f"WARN: Could not fetch VO2 max: {e}")

    try:
        activities = client.get_activities(0, 20)
        total_sweat = 0
        for activity in activities or []:
            act_date = activity.get("startTimeLocal", "")[:10]
            if act_date == today_str:
                total_sweat += estimate_sweat_loss_ml(activity)
        vitals["workout_sweat_loss_ml"] = total_sweat
    except Exception as e:
        print(f"WARN: Could not fetch activities: {e}")

    try:
        recovery = client.get_training_readiness(today_str)
        if recovery:
            vitals["recovery_time_hours"] = recovery.get("recoveryTime")
    except Exception:
        pass

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


if __name__ == "__main__":
    main()
