"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Zap,
  Target,
  Battery,
  Activity,
  Moon,
  Clock,
  BarChart3,
  TrendingUp,
  Scale,
} from "lucide-react";
import MetricCard from "@/app/components/MetricCard";
import MetricModal from "@/app/components/MetricModal";
import {
  DualLineChart,
  BodyBatteryTimeline,
  SleepStagesBar,
} from "@/app/components/Charts";
import { GarminVitals, TrendDataPoint } from "@/lib/types";
import {
  formatDate,
  formatDuration,
  getTrainingStatusColor,
  getHrvStatusColor,
  cn,
} from "@/lib/utils";

export default function RecoveryPage() {
  const [vitals, setVitals] = useState<GarminVitals[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<{
    title: string;
    value: string | number;
    unit?: string;
    data: TrendDataPoint[];
    key: string;
    higherIsBetter?: boolean;
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
    unit = "",
    higherIsBetter = true
  ) => {
    setModal({ title, value, unit, data: getTrend(key), key, higherIsBetter });
  };

  const hrvChartData = vitals.map((v) => ({
    date: v.date,
    value1: v.sleep_score || 0,
    value2: v.hrv_value || 0,
    label1: "Sleep Score",
    label2: "HRV (ms)",
  }));

  const loadChartData = vitals.map((v) => ({
    date: v.date,
    value1: v.acute_load || 0,
    value2: v.chronic_load || 0,
    label1: "Acute Load",
    label2: "Chronic Load",
  }));

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-8 h-8 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white tracking-tight">
          RECOVERY & READINESS
        </h1>
        <p className="text-slate-400 mt-1">
          Athletic strain, sleep architecture, training load & nervous system
          recovery · {formatDate(new Date())}
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
        <MetricCard
          title="Training Readiness"
          value={today.training_readiness ?? "--"}
          subtitle="overall readiness (0–100)"
          icon={<Zap className="w-5 h-5" />}
          onClick={() =>
            openModal(
              "Training Readiness",
              today.training_readiness || 0,
              "training_readiness"
            )
          }
        >
          <div className="h-2 bg-slate-700 rounded-full overflow-hidden mt-2">
            <div
              className="h-full bg-emerald-400 rounded-full"
              style={{ width: `${today.training_readiness || 0}%` }}
            />
          </div>
        </MetricCard>

        <MetricCard
          title="Training Status"
          value={today.training_status || "Unknown"}
          subtitle="current trajectory"
          icon={<Target className="w-5 h-5" />}
          onClick={() =>
            openModal("Acute Load", today.acute_load || 0, "acute_load")
          }
        >
          <span
            className={cn(
              "inline-block mt-2 px-3 py-1 rounded-full text-xs font-medium border",
              getTrainingStatusColor(today.training_status)
            )}
          >
            {today.training_status || "Unknown"}
          </span>
        </MetricCard>

        <MetricCard
          title="Body Battery"
          value={today.body_battery ?? "--"}
          subtitle="energy fuel gauge"
          icon={<Battery className="w-5 h-5" />}
          onClick={() =>
            openModal("Body Battery", today.body_battery || 0, "body_battery")
          }
        >
          <BodyBatteryTimeline current={today.body_battery || 50} />
        </MetricCard>

        <MetricCard
          title="HRV Status"
          value={today.hrv_status || "Unknown"}
          subtitle={`${today.hrv_value || "--"} ms overnight avg`}
          icon={<Activity className="w-5 h-5" />}
          onClick={() =>
            openModal("HRV Value", today.hrv_value || 0, "hrv_value", " ms")
          }
        >
          <p
            className={cn(
              "text-sm font-medium mt-1",
              getHrvStatusColor(today.hrv_status)
            )}
          >
            {today.hrv_status === "Balanced" ? "✓ Balanced" : "⚠ Unbalanced"}
          </p>
        </MetricCard>

        <MetricCard
          title="Sleep Score & Duration"
          value={`${today.sleep_score ?? "--"} · ${today.sleep_duration_min ? formatDuration(today.sleep_duration_min) : "--"}`}
          subtitle="nightly sleep quality"
          icon={<Moon className="w-5 h-5" />}
          onClick={() =>
            openModal("Sleep Score", today.sleep_score || 0, "sleep_score")
          }
        >
          <SleepStagesBar
            deep={today.deep_sleep_min || 0}
            rem={today.rem_sleep_min || 0}
            light={today.light_sleep_min || 0}
          />
        </MetricCard>

        <MetricCard
          title="Recovery Time"
          value={today.recovery_time_hours ?? "--"}
          subtitle="hours until full recovery"
          icon={<Clock className="w-5 h-5" />}
          onClick={() =>
            openModal(
              "Recovery Time",
              today.recovery_time_hours || 0,
              "recovery_time_hours",
              " hrs",
              false
            )
          }
        />
      </div>

      {/* Training Load section */}
      <h2 className="text-lg font-semibold text-white mb-4">Training Load</h2>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <MetricCard
          title="Acute Load"
          value={today.acute_load ?? "--"}
          subtitle="7-day training strain"
          icon={<BarChart3 className="w-5 h-5" />}
          onClick={() =>
            openModal("Acute Load", today.acute_load || 0, "acute_load")
          }
        />

        <MetricCard
          title="Chronic Load"
          value={today.chronic_load ?? "--"}
          subtitle="28-day fitness baseline"
          icon={<TrendingUp className="w-5 h-5" />}
          onClick={() =>
            openModal("Chronic Load", today.chronic_load || 0, "chronic_load")
          }
        />

        <MetricCard
          title="Load Ratio"
          value={
            today.load_ratio != null
              ? today.load_ratio.toFixed(2)
              : today.acute_load && today.chronic_load
                ? (today.acute_load / today.chronic_load).toFixed(2)
                : "--"
          }
          subtitle="acute ÷ chronic (0.8–1.3 ideal)"
          icon={<Scale className="w-5 h-5" />}
          onClick={() =>
            openModal(
              "Load Ratio",
              today.load_ratio ??
                (today.acute_load && today.chronic_load
                  ? Math.round((today.acute_load / today.chronic_load) * 100) /
                    100
                  : 0),
              "load_ratio"
            )
          }
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-slate-800/60 border border-slate-700 rounded-xl p-6">
          <h2 className="text-lg font-semibold text-white mb-4">
            7-Day Sleep Score vs. HRV Trend
          </h2>
          <DualLineChart
            data={hrvChartData}
            color1="#a78bfa"
            color2="#34d399"
          />
        </div>
        <div className="bg-slate-800/60 border border-slate-700 rounded-xl p-6">
          <h2 className="text-lg font-semibold text-white mb-4">
            7-Day Acute vs. Chronic Load
          </h2>
          <DualLineChart
            data={loadChartData}
            color1="#f97316"
            color2="#22d3ee"
          />
        </div>
      </div>

      {modal && (
        <MetricModal
          isOpen={!!modal}
          onClose={() => setModal(null)}
          title={modal.title}
          todayValue={modal.value}
          unit={modal.unit}
          data={modal.data}
          higherIsBetter={modal.higherIsBetter ?? true}
        />
      )}
    </div>
  );
}
