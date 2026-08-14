"use client";

import { useEffect, useCallback } from "react";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { X } from "lucide-react";
import { TrendDataPoint } from "@/lib/types";
import { calculateTrend, formatShortDate } from "@/lib/utils";
import { TrendBadge } from "./MetricCard";

interface MetricModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  todayValue: string | number;
  unit?: string;
  data: TrendDataPoint[];
  chartType?: "line" | "bar";
  color?: string;
  higherIsBetter?: boolean;
  metricLabel?: string;
}

export default function MetricModal({
  isOpen,
  onClose,
  title,
  todayValue,
  unit = "",
  data,
  chartType = "line",
  color = "#22d3ee",
  higherIsBetter = true,
  metricLabel,
}: MetricModalProps) {
  const handleEscape = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    },
    [onClose]
  );

  useEffect(() => {
    if (isOpen) {
      document.addEventListener("keydown", handleEscape);
      document.body.style.overflow = "hidden";
    }
    return () => {
      document.removeEventListener("keydown", handleEscape);
      document.body.style.overflow = "";
    };
  }, [isOpen, handleEscape]);

  if (!isOpen) return null;

  const { average, trendPercent, direction } = calculateTrend(data);
  const chartData = data.map((d) => ({
    ...d,
    displayDate: formatShortDate(d.date),
  }));

  const adjustedDirection =
    higherIsBetter
      ? direction
      : direction === "up"
        ? "down"
        : direction === "down"
          ? "up"
          : "flat";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
      <div
        className="relative w-full max-w-lg bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-6 border-b border-slate-800">
          <div>
            <h2 className="text-lg font-semibold text-white">{title}</h2>
            <p className="text-3xl font-bold text-cyan-400 mt-1">
              {todayValue}
              {unit && (
                <span className="text-lg text-slate-400 ml-1">{unit}</span>
              )}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-xs uppercase tracking-wider text-slate-500">
                7-Day Average
              </p>
              <p className="text-xl font-semibold text-white">
                {average}
                {unit}
              </p>
            </div>
            <TrendBadge
              trendPercent={trendPercent}
              direction={adjustedDirection}
              label={
                metricLabel
                  ? `${metricLabel} than last week`
                  : "vs last week"
              }
            />
          </div>

          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              {chartType === "bar" ? (
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                  <XAxis
                    dataKey="displayDate"
                    stroke="#64748b"
                    fontSize={12}
                  />
                  <YAxis stroke="#64748b" fontSize={12} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#1e293b",
                      border: "1px solid #334155",
                      borderRadius: "8px",
                    }}
                    labelStyle={{ color: "#94a3b8" }}
                  />
                  <Bar dataKey="value" fill={color} radius={[4, 4, 0, 0]} />
                </BarChart>
              ) : (
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                  <XAxis
                    dataKey="displayDate"
                    stroke="#64748b"
                    fontSize={12}
                  />
                  <YAxis stroke="#64748b" fontSize={12} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#1e293b",
                      border: "1px solid #334155",
                      borderRadius: "8px",
                    }}
                    labelStyle={{ color: "#94a3b8" }}
                  />
                  <Line
                    type="monotone"
                    dataKey="value"
                    stroke={color}
                    strokeWidth={2}
                    dot={{ fill: color, r: 4 }}
                    activeDot={{ r: 6 }}
                  />
                </LineChart>
              )}
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}
