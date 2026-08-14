"use client";

import { useState } from "react";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { formatShortDate } from "@/lib/utils";

interface DualLineChartProps {
  data: Array<{
    date: string;
    value1: number;
    value2: number;
    label1: string;
    label2: string;
  }>;
  color1?: string;
  color2?: string;
}

export function DualLineChart({
  data,
  color1 = "#22d3ee",
  color2 = "#a78bfa",
}: DualLineChartProps) {
  const chartData = data.map((d) => ({
    ...d,
    displayDate: formatShortDate(d.date),
  }));

  return (
    <ResponsiveContainer width="100%" height={280}>
      <LineChart data={chartData}>
        <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
        <XAxis dataKey="displayDate" stroke="#64748b" fontSize={12} />
        <YAxis stroke="#64748b" fontSize={12} />
        <Tooltip
          contentStyle={{
            backgroundColor: "#1e293b",
            border: "1px solid #334155",
            borderRadius: "8px",
          }}
        />
        <Legend />
        <Line
          type="monotone"
          dataKey="value1"
          name={data[0]?.label1 || "Series 1"}
          stroke={color1}
          strokeWidth={2}
          dot={{ r: 3 }}
        />
        <Line
          type="monotone"
          dataKey="value2"
          name={data[0]?.label2 || "Series 2"}
          stroke={color2}
          strokeWidth={2}
          dot={{ r: 3 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

interface DualBarChartProps {
  data: Array<{
    date: string;
    value1: number;
    value2: number;
    label1: string;
    label2: string;
  }>;
  color1?: string;
  color2?: string;
}

export function DualBarChart({
  data,
  color1 = "#22d3ee",
  color2 = "#34d399",
}: DualBarChartProps) {
  const chartData = data.map((d) => ({
    ...d,
    displayDate: formatShortDate(d.date),
  }));

  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={chartData}>
        <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
        <XAxis dataKey="displayDate" stroke="#64748b" fontSize={12} />
        <YAxis stroke="#64748b" fontSize={12} />
        <Tooltip
          contentStyle={{
            backgroundColor: "#1e293b",
            border: "1px solid #334155",
            borderRadius: "8px",
          }}
        />
        <Legend />
        <Bar
          dataKey="value1"
          name={data[0]?.label1 || "Series 1"}
          fill={color1}
          radius={[4, 4, 0, 0]}
        />
        <Bar
          dataKey="value2"
          name={data[0]?.label2 || "Series 2"}
          fill={color2}
          radius={[4, 4, 0, 0]}
        />
      </BarChart>
    </ResponsiveContainer>
  );
}

interface BodyBatteryTimelineProps {
  current: number;
}

export function BodyBatteryTimeline({ current }: BodyBatteryTimelineProps) {
  const hours = Array.from({ length: 24 }, (_, i) => {
    const base = current;
    const variation = Math.sin((i / 24) * Math.PI * 2) * 15;
    return Math.max(5, Math.min(100, Math.round(base + variation - i * 1.5)));
  });

  return (
    <div className="mt-2">
      <div className="flex items-end gap-0.5 h-8">
        {hours.filter((_, i) => i % 2 === 0).map((v, i) => (
          <div
            key={i}
            className="flex-1 rounded-sm transition-all"
            style={{
              height: `${(v / 100) * 100}%`,
              backgroundColor:
                v > 60 ? "#22d3ee" : v > 30 ? "#fbbf24" : "#ef4444",
              opacity: 0.7 + (v / 100) * 0.3,
            }}
          />
        ))}
      </div>
      <div className="flex justify-between text-[10px] text-slate-500 mt-1">
        <span>12am</span>
        <span>6am</span>
        <span>12pm</span>
        <span>6pm</span>
      </div>
    </div>
  );
}

interface SleepStagesProps {
  deep: number;
  rem: number;
  light: number;
}

export function SleepStagesBar({ deep, rem, light }: SleepStagesProps) {
  const total = deep + rem + light || 1;
  return (
    <div className="mt-3">
      <div className="flex h-3 rounded-full overflow-hidden">
        <div
          className="bg-indigo-500"
          style={{ width: `${(deep / total) * 100}%` }}
          title={`Deep: ${deep}min`}
        />
        <div
          className="bg-purple-400"
          style={{ width: `${(rem / total) * 100}%` }}
          title={`REM: ${rem}min`}
        />
        <div
          className="bg-slate-500"
          style={{ width: `${(light / total) * 100}%` }}
          title={`Light: ${light}min`}
        />
      </div>
      <div className="flex gap-4 mt-2 text-xs text-slate-400">
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-indigo-500" />
          Deep {deep}m
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-purple-400" />
          REM {rem}m
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-slate-500" />
          Light {light}m
        </span>
      </div>
    </div>
  );
}

interface MacroProgressProps {
  label: string;
  current: number;
  target: number;
  unit: string;
  color: string;
}

export function MacroProgress({
  label,
  current,
  target,
  unit,
  color,
}: MacroProgressProps) {
  const pct = Math.min(100, Math.round((current / target) * 100));
  return (
    <div>
      <div className="flex justify-between text-sm mb-1">
        <span className="text-slate-400">{label}</span>
        <span className="text-white font-medium">
          {current}
          {unit} / {target}
          {unit}
        </span>
      </div>
      <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${pct}%`, backgroundColor: color }}
        />
      </div>
    </div>
  );
}

interface MealScannerProps {
  onAnalyze: (file: File) => Promise<void>;
  isAnalyzing: boolean;
}

export function MealScanner({ onAnalyze, isAnalyzing }: MealScannerProps) {
  const [dragOver, setDragOver] = useState(false);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith("image/")) {
      onAnalyze(file);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) onAnalyze(file);
  };

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={handleDrop}
      className={`relative border-2 border-dashed rounded-xl p-8 text-center transition-colors ${
        dragOver
          ? "border-cyan-400 bg-cyan-400/5"
          : "border-slate-600 hover:border-slate-500"
      }`}
    >
      <input
        type="file"
        accept="image/*"
        onChange={handleFileSelect}
        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
        disabled={isAnalyzing}
      />
      <div className="pointer-events-none">
        {isAnalyzing ? (
          <>
            <div className="w-10 h-10 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            <p className="text-cyan-400 font-medium">Analyzing meal...</p>
          </>
        ) : (
          <>
            <p className="text-white font-medium mb-1">
              Drop meal photo here or click to upload
            </p>
            <p className="text-sm text-slate-400">
              Gemini AI will estimate calories & macros for lean bulk
            </p>
          </>
        )}
      </div>
    </div>
  );
}
