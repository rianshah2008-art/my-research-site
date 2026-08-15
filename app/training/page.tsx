"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Footprints,
  Bike,
  Waves,
  HeartPulse,
  Gauge,
  Flame,
  Mountain,
} from "lucide-react";
import MetricCard from "@/app/components/MetricCard";
import MetricModal from "@/app/components/MetricModal";
import { DualLineChart } from "@/app/components/Charts";
import { GarminVitals, TrendDataPoint } from "@/lib/types";
import { formatDate, formatPace } from "@/lib/utils";

export default function TrainingPage() {
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

  // Pace (sec/mi) vs Lactate Threshold HR — dual axis comparison chart
  const paceVsLtChart = vitals.map((v) => ({
    date: v.date,
    value1: v.run_pace_sec_per_mile || 0,
    value2: v.lactate_threshold_hr || 0,
    label1: "Run Pace (sec/mi)",
    label2: "LT Heart Rate (bpm)",
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
          TRAINING PERFORMANCE
        </h1>
        <p className="text-slate-400 mt-1">
          Pace, physiological thresholds & environmental acclimation ·{" "}
          {formatDate(new Date())}
        </p>
      </div>

      {/* Pace / Time */}
      <h2 className="text-sm font-medium uppercase tracking-wider text-slate-500 mb-3">
        Pace / Time
      </h2>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <MetricCard
          title="Running Mile Time"
          value={formatPace(today.run_pace_sec_per_mile)}
          subtitle="min / mile"
          icon={<Footprints className="w-5 h-5" />}
          onClick={() =>
            openModal(
              "Running Mile Pace",
              today.run_pace_sec_per_mile || 0,
              "run_pace_sec_per_mile",
              " sec/mi",
              false
            )
          }
        />

        <MetricCard
          title="Biking Mile Time"
          value={formatPace(today.bike_pace_sec_per_mile)}
          subtitle="min / mile"
          icon={<Bike className="w-5 h-5" />}
          onClick={() =>
            openModal(
              "Biking Mile Pace",
              today.bike_pace_sec_per_mile || 0,
              "bike_pace_sec_per_mile",
              " sec/mi",
              false
            )
          }
        />

        <MetricCard
          title="Swimming Pace"
          value={formatPace(today.swim_pace_sec_per_100m)}
          subtitle="min / 100m"
          icon={<Waves className="w-5 h-5" />}
          onClick={() =>
            openModal(
              "Swimming Pace",
              today.swim_pace_sec_per_100m || 0,
              "swim_pace_sec_per_100m",
              " sec/100m",
              false
            )
          }
        />
      </div>

      {/* Thresholds */}
      <h2 className="text-sm font-medium uppercase tracking-wider text-slate-500 mb-3">
        Thresholds
      </h2>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <MetricCard
          title="Lactate Threshold HR"
          value={today.lactate_threshold_hr ?? "--"}
          subtitle="bpm at LT"
          icon={<HeartPulse className="w-5 h-5" />}
          onClick={() =>
            openModal(
              "Lactate Threshold HR",
              today.lactate_threshold_hr || 0,
              "lactate_threshold_hr",
              " bpm"
            )
          }
        />

        <MetricCard
          title="Lactate Threshold Pace"
          value={formatPace(today.lactate_threshold_pace_sec)}
          subtitle="min / mile at LT"
          icon={<Gauge className="w-5 h-5" />}
          onClick={() =>
            openModal(
              "Lactate Threshold Pace",
              today.lactate_threshold_pace_sec || 0,
              "lactate_threshold_pace_sec",
              " sec/mi",
              false
            )
          }
        />

        <MetricCard
          title="Cycling FTP"
          value={today.cycling_ftp_watts ?? "--"}
          subtitle="functional threshold power"
          icon={<Bike className="w-5 h-5" />}
          onClick={() =>
            openModal(
              "Cycling FTP",
              today.cycling_ftp_watts || 0,
              "cycling_ftp_watts",
              " W"
            )
          }
        />
      </div>

      {/* Environment */}
      <h2 className="text-sm font-medium uppercase tracking-wider text-slate-500 mb-3">
        Environment
      </h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
        <MetricCard
          title="Heat Acclimation"
          value={
            today.heat_acclimation_pct != null
              ? `${today.heat_acclimation_pct}%`
              : "--"
          }
          subtitle="adaptation to heat stress"
          icon={<Flame className="w-5 h-5" />}
          onClick={() =>
            openModal(
              "Heat Acclimation",
              today.heat_acclimation_pct || 0,
              "heat_acclimation_pct",
              "%"
            )
          }
        >
          <div className="h-2 bg-slate-700 rounded-full overflow-hidden mt-2">
            <div
              className="h-full bg-orange-400 rounded-full"
              style={{ width: `${today.heat_acclimation_pct || 0}%` }}
            />
          </div>
        </MetricCard>

        <MetricCard
          title="Altitude Acclimation"
          value={
            today.altitude_acclimation_m != null
              ? `${today.altitude_acclimation_m.toLocaleString()} m`
              : "--"
          }
          subtitle="adapted elevation"
          icon={<Mountain className="w-5 h-5" />}
          onClick={() =>
            openModal(
              "Altitude Acclimation",
              today.altitude_acclimation_m || 0,
              "altitude_acclimation_m",
              " m"
            )
          }
        />
      </div>

      <div className="bg-slate-800/60 border border-slate-700 rounded-xl p-6">
        <h2 className="text-lg font-semibold text-white mb-4">
          7-Day Running Pace vs. Lactate Threshold HR
        </h2>
        <DualLineChart
          data={paceVsLtChart}
          color1="#22d3ee"
          color2="#f43f5e"
        />
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
