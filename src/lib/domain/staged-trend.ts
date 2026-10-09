import type { StagedFreeeRow } from "./freee-staging";
import type { FinancialSnapshot } from "./types";

export function stagedTrend(
  rows: StagedFreeeRow[],
): Pick<FinancialSnapshot, "period" | "trend" | "isMock"> | null {
  const byMonth = new Map<string, StagedFreeeRow>();
  for (const row of [...rows].sort((a, b) =>
    b.provenance.retrievedAt.localeCompare(a.provenance.retrievedAt),
  )) {
    if (row.candidate.completeness === "month-to-date") continue;
    if (
      row.period !== row.candidate.period ||
      row.period !== row.provenance.period
    )
      throw new Error("取込候補の対象月が一致しません。");
    if (!byMonth.has(row.period)) byMonth.set(row.period, row);
  }
  const ordered = [...byMonth.values()]
    .sort((a, b) => a.period.localeCompare(b.period))
    .slice(-12);
  if (!ordered.length) return null;
  return {
    period: ordered[ordered.length - 1].period,
    isMock: false,
    trend: ordered.map(({ period, candidate }) => ({
      month: `${period.slice(2, 4)}/${period.slice(5)}`,
      revenue: candidate.revenue.current,
      previousRevenue: candidate.revenue.previous,
      profit: candidate.operatingProfit.current,
      previousProfit: candidate.operatingProfit.previous,
    })),
  };
}
