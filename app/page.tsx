"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Footprints,
  Heart,
  Flame,
  Droplets,
  Wind,
  Brain,
  RefreshCw,
} from "lucide-react";
import MetricCard from "@/app/components/MetricCard";
import MetricModal from "@/app/components/MetricModal";
import Sparkline from "@/app/components/Sparkline";
import { DualLineChart } from "@/app/components/Charts";
import { GarminVitals, TrendDataPoint, STEPS_GOAL } from "@/lib/types";
import { formatDate } from "@/lib/utils";

export default function DailyVitalsPage() {
  const [vitals, setVitals] = useState<GarminVitals[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState("");
  const [modal, setModal] = useState<{
    title: string;
    value: string | number;
    unit?: string;
    data: TrendDataPoint[];
    key: string;
  } | null>(null);

  const fetchVitals = useCallback(async () => {
    try {
      const res = await fetch("/api/vitals");
      const data = await res.json();
      setVitals(data);
    } catch {
      console.error("Failed to fetch vitals");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchVitals();
  }, [fetchVitals]);

  const today = vitals[vitals.length - 1] || ({} as GarminVitals);

  const getTrend = (key: keyof GarminVitals): TrendDataPoint[] =>
    vitals.map((v) => ({
      date: v.date,
      value: typeof v[key] === "number" ? (v[key] as number) : 0,
    }));

  const openModal = (
    title: string,
    value: string | number,
    key: keyof GarminVitals,
    unit = ""
  ) => {
    setModal({ title, value, unit, data: getTrend(key), key });
  };

  const handleSync = async () => {
    setSyncing(true);
    setSyncMessage("");
    try {
      const res = await fetch("/api/sync-garmin", { method: "POST" });
      const data = await res.json();
      setSyncMessage(data.message || (data.success ? "Synced!" : "Sync failed"));
      if (data.success) await fetchVitals();
    } catch {
      setSyncMessage("Sync failed");
    } finally {
      setSyncing(false);
    }
  };

  const stepsProgress = today.steps
    ? Math.round((today.steps / STEPS_GOAL) * 100)
    : 0;

  const chartData = vitals.map((v) => ({
    date: v.date,
    value1: v.steps || 0,
    value2: v.active_calories || 0,
    label1: "Steps",
    label2: "Active Cal",
  }));

  const rhrTrend = getTrend("resting_hr").map((d) => d.value);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-8 h-8 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-8 gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">
            APEX CONNECT: DAILY VITALS
          </h1>
          <p className="text-slate-400 mt-1">{formatDate(new Date())}</p>
        </div>
        <button
          onClick={handleSync}
          disabled={syncing}
          className="flex items-center gap-2 px-5 py-2.5 bg-cyan-500 hover:bg-cyan-400 disabled:bg-cyan-500/50 text-slate-900 font-semibold rounded-lg transition-colors"
        >
          <RefreshCw className={`w-4 h-4 ${syncing ? "animate-spin" : ""}`} />
          {syncing ? "Syncing..." : "Sync Garmin Data"}
        </button>
      </div>

      {syncMessage && (
        <div className="mb-6 px-4 py-3 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-300">
          {syncMessage}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
        <MetricCard
          title="Daily Steps"
          value={(today.steps || 0).toLocaleString()}
          subtitle={`${stepsProgress}% of ${STEPS_GOAL.toLocaleString()} goal`}
          icon={<Footprints className="w-5 h-5" />}
          onClick={() =>
            openModal("Daily Steps", today.steps || 0, "steps", " steps")
          }
        >
          <div className="h-2 bg-slate-700 rounded-full overflow-hidden mt-2">
            <div
              className="h-full bg-cyan-400 rounded-full transition-all"
              style={{ width: `${Math.min(100, stepsProgress)}%` }}
            />
          </div>
        </MetricCard>

        <MetricCard
          title="Resting Heart Rate"
          value={today.resting_hr || "--"}
          subtitle="bpm · 24hr trend"
          icon={<Heart className="w-5 h-5" />}
          onClick={() =>
            openModal("Resting Heart Rate", today.resting_hr || 0, "resting_hr", " bpm")
          }
        >
          <Sparkline data={rhrTrend.length > 1 ? rhrTrend : [60, 58, 55, 57, 56, 54, today.resting_hr || 55]} />
        </MetricCard>

        <MetricCard
          title="Active & Total Calories"
          value={`${today.active_calories || 0} / ${today.total_calories_burned || 0}`}
          subtitle="active / total kcal"
          icon={<Flame className="w-5 h-5" />}
          onClick={() =>
            openModal(
              "Active Calories",
              today.active_calories || 0,
              "active_calories",
              " kcal"
            )
          }
        />

        <MetricCard
          title="Pulse Ox (SpO₂)"
          value={today.spo2 ? `${today.spo2}%` : "--"}
          subtitle="overnight average"
          icon={<Droplets className="w-5 h-5" />}
          onClick={() =>
            openModal("Pulse Ox", today.spo2 || 0, "spo2", "%")
          }
        />

        <MetricCard
          title="Respiration Rate"
          value={today.respiration_rate || "--"}
          subtitle="breaths per minute"
          icon={<Wind className="w-5 h-5" />}
          onClick={() =>
            openModal(
              "Respiration Rate",
              today.respiration_rate || 0,
              "respiration_rate",
              " br/min"
            )
          }
        />

        <MetricCard
          title="Stress Level"
          value={today.stress_level || "--"}
          subtitle="daily average (0-100)"
          icon={<Brain className="w-5 h-5" />}
          onClick={() =>
            openModal("Stress Level", today.stress_level || 0, "stress_level")
          }
        >
          <div className="h-2 bg-slate-700 rounded-full overflow-hidden mt-2">
            <div
              className="h-full rounded-full transition-all"
              style={{
                width: `${today.stress_level || 0}%`,
                backgroundColor:
                  (today.stress_level || 0) > 60
                    ? "#ef4444"
                    : (today.stress_level || 0) > 35
                      ? "#fbbf24"
                      : "#22d3ee",
              }}
            />
          </div>
        </MetricCard>
      </div>

      <div className="bg-slate-800/60 border border-slate-700 rounded-xl p-6">
        <h2 className="text-lg font-semibold text-white mb-4">
          7-Day Steps vs. Active Calories
        </h2>
        <DualLineChart data={chartData} color1="#22d3ee" color2="#f97316" />
      </div>

      {modal && (
        <MetricModal
          isOpen={!!modal}
          onClose={() => setModal(null)}
          title={modal.title}
          todayValue={modal.value}
          unit={modal.unit}
          data={modal.data}
          higherIsBetter={modal.key !== "stress_level" && modal.key !== "resting_hr"}
        />
      )}
    </div>
  );
}
