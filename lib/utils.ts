import { format, subDays, parseISO } from "date-fns";
import { TrendDataPoint } from "./types";

export function formatDate(date: Date | string): string {
  const d = typeof date === "string" ? parseISO(date) : date;
  return format(d, "MMM d, yyyy");
}

export function formatShortDate(date: string): string {
  return format(parseISO(date), "EEE");
}

export function getLast7Days(): string[] {
  const days: string[] = [];
  for (let i = 6; i >= 0; i--) {
    days.push(format(subDays(new Date(), i), "yyyy-MM-dd"));
  }
  return days;
}

export function calculateTrend(data: TrendDataPoint[]): {
  average: number;
  trendPercent: number;
  direction: "up" | "down" | "flat";
} {
  if (data.length === 0) {
    return { average: 0, trendPercent: 0, direction: "flat" };
  }

  const values = data.map((d) => d.value);
  const average = values.reduce((a, b) => a + b, 0) / values.length;

  const mid = Math.floor(values.length / 2);
  const firstHalf = values.slice(0, mid);
  const secondHalf = values.slice(mid);

  const firstAvg =
    firstHalf.length > 0
      ? firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length
      : 0;
  const secondAvg =
    secondHalf.length > 0
      ? secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length
      : 0;

  let trendPercent = 0;
  if (firstAvg > 0) {
    trendPercent = Math.round(((secondAvg - firstAvg) / firstAvg) * 100);
  }

  const direction =
    trendPercent > 2 ? "up" : trendPercent < -2 ? "down" : "flat";

  return { average: Math.round(average * 10) / 10, trendPercent, direction };
}

export function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h}h ${m}m`;
}

export function getTrainingStatusColor(status: string | null): string {
  switch (status?.toLowerCase()) {
    case "productive":
      return "bg-emerald-500/20 text-emerald-400 border-emerald-500/30";
    case "overreaching":
      return "bg-red-500/20 text-red-400 border-red-500/30";
    case "unproductive":
      return "bg-amber-500/20 text-amber-400 border-amber-500/30";
    case "maintaining":
      return "bg-blue-500/20 text-blue-400 border-blue-500/30";
    default:
      return "bg-slate-500/20 text-slate-400 border-slate-500/30";
  }
}

export function getHrvStatusColor(status: string | null): string {
  return status?.toLowerCase() === "balanced"
    ? "text-emerald-400"
    : "text-amber-400";
}

export function cn(...classes: (string | boolean | undefined)[]): string {
  return classes.filter(Boolean).join(" ");
}
