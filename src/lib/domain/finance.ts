import type { Driver } from "./types";

export function compareYoY(current: number, previous: number) {
  return {
    delta: current - previous,
    percent:
      previous > 0
        ? Math.round(((current - previous) / previous) * 1000) / 10
        : null,
  };
}
export function yoyPresentation(current: number, previous: number) {
  const comparison = compareYoY(current, previous);
  return {
    ...comparison,
    direction:
      comparison.delta > 0 ? "up" : comparison.delta < 0 ? "down" : "flat",
    label:
      comparison.percent === null
        ? `${comparison.delta > 0 ? "+" : ""}${millions(comparison.delta)}百万円`
        : percent(comparison.percent),
    note:
      comparison.percent === null ? "前年同月が0以下のため増減額を表示" : null,
  };
}

/** Include zero and losses, with a nonzero span even for an all-zero series. */
export function financialChartScale(values: number[], step: number) {
  const min = Math.floor(Math.min(0, ...values) / step) * step;
  const upper = Math.ceil(Math.max(0, ...values) / step) * step;
  const max = upper === min ? min + step : upper;
  return {
    min,
    max,
    ticks: Array.from({ length: 4 }, (_, i) => min + ((max - min) * i) / 3),
    y: (value: number) => 222 - ((value - min) / (max - min)) * 190,
  };
}
export function reconcileDrivers(
  previous: number,
  current: number,
  drivers: Driver[],
) {
  return (
    previous + drivers.reduce((total, driver) => total + driver.amount, 0) ===
    current
  );
}
export function millions(value: number, digits = 2) {
  return (value / 1_000_000).toLocaleString("en-US", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}
export function percent(value: number) {
  return `${value > 0 ? "+" : ""}${value.toFixed(1)}%`;
}
export function periodLabel(period: string) {
  const [year, month] = period.split("-").map(Number);
  return `${year}年${month}月`;
}
export function margin(profit: number, revenue: number) {
  return revenue > 0 ? (profit / revenue) * 100 : 0;
}
