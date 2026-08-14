"use client";

import { useEffect, useState, useCallback } from "react";
import { Scale, Droplets } from "lucide-react";
import MetricCard from "@/app/components/MetricCard";
import MetricModal from "@/app/components/MetricModal";
import {
  DualBarChart,
  MacroProgress,
  MealScanner,
} from "@/app/components/Charts";
import {
  NutritionLog,
  TrendDataPoint,
  LEAN_BULK_CALORIES,
  LEAN_BULK_PROTEIN,
  BASE_WEIGHT_LBS,
  HYDRATION_ML_PER_LB,
} from "@/lib/types";
import { formatDate } from "@/lib/utils";

interface NutritionData {
  logs: NutritionLog[];
  todayCalories: number;
  todayProtein: number;
  todayHydration: number;
  currentWeight: number;
  trend: {
    calories: TrendDataPoint[];
    protein: TrendDataPoint[];
    hydration: TrendDataPoint[];
  };
}

export default function NutritionPage() {
  const [data, setData] = useState<NutritionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [weight, setWeight] = useState(BASE_WEIGHT_LBS);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [sweatLoss, setSweatLoss] = useState(0);
  const [modal, setModal] = useState<{
    title: string;
    value: string | number;
    unit?: string;
    data: TrendDataPoint[];
    chartType?: "line" | "bar";
  } | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const [nutritionRes, vitalsRes] = await Promise.all([
        fetch("/api/nutrition"),
        fetch("/api/vitals"),
      ]);
      const nutritionData = await nutritionRes.json();
      const vitalsData = await vitalsRes.json();

      setData(nutritionData);
      setWeight(nutritionData.currentWeight || BASE_WEIGHT_LBS);

      const todayVitals = vitalsData[vitalsData.length - 1];
      setSweatLoss(todayVitals?.workout_sweat_loss_ml || 0);
    } catch {
      console.error("Failed to fetch nutrition data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const baseHydration = weight * HYDRATION_ML_PER_LB;
  const hydrationTarget = baseHydration + sweatLoss;
  const hydrationRemaining = Math.max(
    0,
    hydrationTarget - (data?.todayHydration || 0)
  );

  const handleWeightLog = async () => {
    await fetch("/api/nutrition", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "weight", weight_lbs: weight }),
    });
  };

  const handleHydrationAdd = async (amount: number) => {
    await fetch("/api/nutrition", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "hydration", amount_ml: amount }),
    });
    await fetchData();
  };

  const handleMealAnalyze = async (file: File) => {
    setIsAnalyzing(true);
    try {
      const formData = new FormData();
      formData.append("image", file);

      const res = await fetch("/api/analyze-food", { method: "POST", body: formData });
      const analysis = await res.json();

      if (analysis.error) {
        alert(analysis.error);
        return;
      }

      await fetch("/api/nutrition", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "nutrition", ...analysis }),
      });

      await fetchData();
    } catch {
      alert("Failed to analyze meal");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const chartData =
    data?.trend.calories.map((c, i) => ({
      date: c.date,
      value1: c.value,
      value2: data.trend.hydration[i]?.value || 0,
      label1: "Calories",
      label2: "Water (mL)",
    })) || [];

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
          WEIGHT, HYDRATION & NUTRITION
        </h1>
        <p className="text-slate-400 mt-1">
          Lean bulk tracking · {formatDate(new Date())}
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Weight Widget */}
        <div className="bg-slate-800/60 border border-slate-700 rounded-xl p-6">
          <div className="flex items-center gap-3 mb-4">
            <Scale className="w-5 h-5 text-cyan-400" />
            <h2 className="text-lg font-semibold text-white">Weight Logger</h2>
          </div>
          <div className="flex items-center gap-4">
            <input
              type="number"
              step="0.1"
              value={weight}
              onChange={(e) => setWeight(parseFloat(e.target.value) || 0)}
              className="flex-1 bg-slate-900 border border-slate-600 rounded-lg px-4 py-3 text-2xl font-bold text-white focus:outline-none focus:ring-2 focus:ring-cyan-500/40"
            />
            <span className="text-slate-400 text-lg">lbs</span>
          </div>
          <button
            onClick={handleWeightLog}
            className="mt-4 w-full py-2.5 bg-slate-700 hover:bg-slate-600 text-white font-medium rounded-lg transition-colors"
          >
            Log Weight
          </button>
        </div>

        {/* Hydration Tracker */}
        <div className="bg-slate-800/60 border border-slate-700 rounded-xl p-6">
          <div className="flex items-center gap-3 mb-4">
            <Droplets className="w-5 h-5 text-cyan-400" />
            <h2 className="text-lg font-semibold text-white">
              Dynamic Hydration
            </h2>
          </div>

          <div className="space-y-2 text-sm text-slate-400 mb-4">
            <p>
              Base: {weight} lbs × {HYDRATION_ML_PER_LB} mL ={" "}
              <span className="text-white font-medium">
                {baseHydration.toLocaleString()} mL
              </span>
            </p>
            {sweatLoss > 0 && (
              <p>
                Workout sweat loss:{" "}
                <span className="text-amber-400 font-medium">
                  +{sweatLoss.toLocaleString()} mL
                </span>
              </p>
            )}
            <p>
              Target:{" "}
              <span className="text-cyan-400 font-medium">
                {hydrationTarget.toLocaleString()} mL
              </span>
            </p>
          </div>

          <div className="mb-4">
            <div className="flex justify-between text-sm mb-1">
              <span className="text-slate-400">Progress</span>
              <span className="text-white">
                {(data?.todayHydration || 0).toLocaleString()} /{" "}
                {hydrationTarget.toLocaleString()} mL
              </span>
            </div>
            <div className="h-3 bg-slate-700 rounded-full overflow-hidden">
              <div
                className="h-full bg-cyan-400 rounded-full transition-all"
                style={{
                  width: `${Math.min(100, ((data?.todayHydration || 0) / hydrationTarget) * 100)}%`,
                }}
              />
            </div>
          </div>

          <p className="text-lg font-semibold text-white mb-3">
            {hydrationRemaining.toLocaleString()} mL remaining
          </p>

          <div className="flex gap-2">
            {[250, 500, 750].map((ml) => (
              <button
                key={ml}
                onClick={() => handleHydrationAdd(ml)}
                className="flex-1 py-2 bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/30 text-cyan-400 font-medium rounded-lg transition-colors text-sm"
              >
                +{ml}mL
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Macro Progress */}
      <div className="bg-slate-800/60 border border-slate-700 rounded-xl p-6 mb-8">
        <h2 className="text-lg font-semibold text-white mb-4">
          Lean Bulk Targets
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <MacroProgress
            label="Calories"
            current={data?.todayCalories || 0}
            target={LEAN_BULK_CALORIES}
            unit=""
            color="#22d3ee"
          />
          <MacroProgress
            label="Protein"
            current={data?.todayProtein || 0}
            target={LEAN_BULK_PROTEIN}
            unit="g"
            color="#a78bfa"
          />
        </div>
      </div>

      {/* Meal Scanner */}
      <div className="bg-slate-800/60 border border-slate-700 rounded-xl p-6 mb-8">
        <h2 className="text-lg font-semibold text-white mb-4">
          AI Photo Meal Scanner
        </h2>
        <MealScanner onAnalyze={handleMealAnalyze} isAnalyzing={isAnalyzing} />

        {data?.logs && data.logs.length > 0 && (
          <div className="mt-6 space-y-3">
            <h3 className="text-sm font-medium text-slate-400 uppercase tracking-wider">
              Today&apos;s Meals
            </h3>
            {data.logs.map((log) => (
              <div
                key={log.id}
                className="flex items-center justify-between bg-slate-900/50 border border-slate-700 rounded-lg p-4"
              >
                <div>
                  <p className="text-white font-medium">{log.dish_name}</p>
                  <p className="text-sm text-slate-400">
                    P: {log.protein_g}g · C: {log.carbs_g}g · F: {log.fat_g}g
                  </p>
                </div>
                <p className="text-cyan-400 font-bold">{log.calories} kcal</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Metric cards for trends */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <MetricCard
          title="Today's Calories"
          value={data?.todayCalories || 0}
          subtitle={`target: ${LEAN_BULK_CALORIES}`}
          onClick={() =>
            setModal({
              title: "Daily Calories",
              value: data?.todayCalories || 0,
              unit: " kcal",
              data: data?.trend.calories || [],
              chartType: "bar",
            })
          }
        />
        <MetricCard
          title="Today's Protein"
          value={`${data?.todayProtein || 0}g`}
          subtitle={`target: ${LEAN_BULK_PROTEIN}g`}
          onClick={() =>
            setModal({
              title: "Daily Protein",
              value: data?.todayProtein || 0,
              unit: "g",
              data: data?.trend.protein || [],
              chartType: "bar",
            })
          }
        />
        <MetricCard
          title="Water Consumed"
          value={`${(data?.todayHydration || 0).toLocaleString()} mL`}
          subtitle={`target: ${hydrationTarget.toLocaleString()} mL`}
          onClick={() =>
            setModal({
              title: "Daily Hydration",
              value: data?.todayHydration || 0,
              unit: " mL",
              data: data?.trend.hydration || [],
              chartType: "bar",
            })
          }
        />
      </div>

      <div className="bg-slate-800/60 border border-slate-700 rounded-xl p-6">
        <h2 className="text-lg font-semibold text-white mb-4">
          7-Day Calorie Intake vs. Water Consumed
        </h2>
        <DualBarChart data={chartData} color1="#22d3ee" color2="#34d399" />
      </div>

      {modal && (
        <MetricModal
          isOpen={!!modal}
          onClose={() => setModal(null)}
          title={modal.title}
          todayValue={modal.value}
          unit={modal.unit}
          data={modal.data}
          chartType={modal.chartType}
        />
      )}
    </div>
  );
}
