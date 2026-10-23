import { mockManagementSummary } from "./fiscal-summary";
import { fiscalSourceSchema } from "../domain/fiscal";
const metric = (revenue: number, profit: number) => ({
  revenue,
  costOfSales: Math.round(revenue * 0.3),
  grossProfit: revenue - Math.round(revenue * 0.3),
  sga: revenue - Math.round(revenue * 0.3) - profit,
  operatingProfit: profit,
  ordinaryProfit: profit + 100_000,
});
export function mockFiscalSource(year: number) {
  const prev = Array.from({ length: 12 }, (_, i) => ({
    period: new Date(Date.UTC(year - 2, 10 + i, 1)).toISOString().slice(0, 7),
    metrics: metric(30_000_000 + i * 500_000, 2_000_000 + i * 80_000),
  }));
  return fiscalSourceSchema.parse({
    fiscalEndYear: year,
    managementSummary: {
      ...mockManagementSummary,
      asOf: `${year}-10-23`,
      schoolLaunches: {
        ...mockManagementSummary.schoolLaunches,
        confirmed: mockManagementSummary.schoolLaunches.confirmed.map((p) => ({
          ...p,
          period: `${year}-02`,
        })),
      },
    },
    asOf: `${year}-10-23`,
    outlook: {
      targetRevenue: 600_000_000,
      targetOperatingProfit: null,
      forecastRevenue: null,
      forecastOperatingProfit: null,
      sourceLabel: "架空の経営目標",
      sourceUrl: null,
      asOf: `${year}-10-23`,
    },
    previousFiscalYear: prev,
    months: Array.from({ length: 11 }, (_, i) => ({
      period: new Date(Date.UTC(year - 1, 10 + i, 1)).toISOString().slice(0, 7),
      retrievedAt: `${year}-10-23T00:00:00Z`,
      monthly: metric(36_000_000 + i * 700_000, 1_500_000 + i * 60_000),
      previousYear: prev[i].metrics,
      bsTotals: {
        assets: 180_000_000 + i * 100_000,
        liabilities: 90_000_000,
        equity: 90_000_000 + i * 100_000,
        cash: 80_000_000 - i * 500_000,
        currentAssets: 120_000_000,
        currentLiabilities: 60_000_000,
      },
      nativeClosedThrough: null,
      temporaryClosedThrough: `${year}-05-31`,
    })),
  });
}
