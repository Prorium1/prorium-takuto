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
export function percent(value: number | null) {
  if (value === null) return "算定不可";
  return `${value > 0 ? "+" : ""}${value.toFixed(1)}%`;
}
export function periodLabel(period: string) {
  const [year, month] = period.split("-").map(Number);
  return `${year}年${month}月`;
}
export function margin(profit: number, revenue: number) {
  return revenue > 0 ? (profit / revenue) * 100 : 0;
}
