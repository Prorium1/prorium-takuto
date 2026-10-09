import { periodSchema } from "./validation";

function jstDate(at: Date) {
  if (!Number.isFinite(at.getTime()))
    throw new Error("有効な基準日が必要です。");
  return new Date(at.getTime() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
}
const monthIndex = (period: string) =>
  Number(period.slice(0, 4)) * 12 + Number(period.slice(5)) - 1;
const periodAt = (index: number) =>
  `${Math.floor(index / 12)}-${String((index % 12) + 1).padStart(2, "0")}`;

export function novemberFiscalStart(at = new Date()) {
  const date = jstDate(at);
  const year = Number(date.slice(0, 4));
  return `${Number(date.slice(5, 7)) >= 11 ? year : year - 1}-11`;
}

/** A read-only plan. Calendar completion never establishes accounting close. */
export function buildFreeeImportPlan(startPeriod: string, asOf = new Date()) {
  periodSchema.parse(startPeriod);
  const today = jstDate(asOf);
  const currentPeriod = today.slice(0, 7);
  const start = monthIndex(startPeriod);
  const end = monthIndex(currentPeriod);
  if (start > end || end - start >= 24)
    throw new Error("取込対象は現在月までの24か月以内で指定してください。");
  return Array.from({ length: end - start + 1 }, (_, i) => {
    const period = periodAt(start + i);
    const current = period === currentPeriod;
    const lastDay = new Date(
      Date.UTC(Number(period.slice(0, 4)), Number(period.slice(5)), 0),
    ).getUTCDate();
    return {
      period,
      previousPeriod: periodAt(start + i - 12),
      from: `${period}-01`,
      through: current ? today : `${period}-${lastDay}`,
      status: current
        ? ("in-progress" as const)
        : ("closing-unconfirmed" as const),
      // The future importer must obtain an explicit management close confirmation.
      canPublishAsMonthlyActual: false as const,
    };
  });
}
