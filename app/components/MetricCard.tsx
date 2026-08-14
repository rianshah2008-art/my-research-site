"use client";

import { ReactNode } from "react";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { cn } from "@/lib/utils";

interface MetricCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon?: ReactNode;
  accent?: string;
  onClick?: () => void;
  children?: ReactNode;
  className?: string;
}

export default function MetricCard({
  title,
  value,
  subtitle,
  icon,
  accent = "border-slate-700 hover:border-cyan-500/50",
  onClick,
  children,
  className,
}: MetricCardProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "w-full text-left bg-slate-800/60 border rounded-xl p-5 transition-all duration-200",
        "hover:bg-slate-800 hover:shadow-lg hover:shadow-cyan-500/5",
        "focus:outline-none focus:ring-2 focus:ring-cyan-500/40",
        accent,
        className
      )}
    >
      <div className="flex items-start justify-between mb-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-slate-400">
            {title}
          </p>
          <p className="text-2xl font-bold text-white mt-1">{value}</p>
          {subtitle && (
            <p className="text-sm text-slate-400 mt-1">{subtitle}</p>
          )}
        </div>
        {icon && (
          <div className="p-2 rounded-lg bg-slate-700/50 text-cyan-400">
            {icon}
          </div>
        )}
      </div>
      {children}
    </button>
  );
}

export function TrendBadge({
  trendPercent,
  direction,
  label,
}: {
  trendPercent: number;
  direction: "up" | "down" | "flat";
  label?: string;
}) {
  const Icon =
    direction === "up"
      ? TrendingUp
      : direction === "down"
        ? TrendingDown
        : Minus;

  const colorClass =
    direction === "up"
      ? "text-emerald-400"
      : direction === "down"
        ? "text-red-400"
        : "text-slate-400";

  return (
    <div className={cn("flex items-center gap-1 text-sm", colorClass)}>
      <Icon className="w-4 h-4" />
      <span>
        {trendPercent > 0 ? "+" : ""}
        {trendPercent}% {label || "vs last week"}
      </span>
    </div>
  );
}
