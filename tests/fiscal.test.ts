import test from "node:test";
import assert from "node:assert/strict";
import { fiscalSourceSchema, fiscalSummary } from "../src/lib/domain/fiscal";
import { mockManagementSummary } from "../src/lib/mock/fiscal-summary";
const metric = (revenue: number, profit: number) => ({
  revenue,
  costOfSales: 200,
  grossProfit: revenue - 200,
  sga: revenue - 200 - profit,
  operatingProfit: profit,
  ordinaryProfit: profit + 10,
});
const periods = Array.from({ length: 11 }, (_, i) =>
  new Date(Date.UTC(2025, 10 + i, 1)).toISOString().slice(0, 7),
);
const input = {
  fiscalEndYear: 2026,
  asOf: "2026-10-23",
  months: periods.map((period) => ({
    period,
    retrievedAt: "2026-10-23T00:00:00Z",
    monthly: metric(1000, 100),
    previousYear: metric(800, 50),
    bsTotals: {
      assets: 5000,
      liabilities: 4000,
      equity: 1000,
      cash: 2000,
      currentAssets: 3000,
      currentLiabilities: 2000,
    },
    nativeClosedThrough: null,
    temporaryClosedThrough: "2026-05-31",
  })),
  previousFiscalYear: Array.from({ length: 12 }, (_, i) => ({
    period: new Date(Date.UTC(2024, 10 + i, 1)).toISOString().slice(0, 7),
    metrics: metric(800, 50),
  })),
  outlook: {
    targetRevenue: 15000,
    targetOperatingProfit: null,
    forecastRevenue: null,
    forecastOperatingProfit: null,
    sourceLabel: "架空目標",
    sourceUrl: null,
    asOf: "2026-10-23",
  },
};
test("fiscal summary separates 11 months of actuals, 1 forecast month and a management target", () => {
  const s = fiscalSourceSchema.parse(input),
    r = fiscalSummary(s);
  assert.equal(r.actual.revenue, 11000);
  assert.equal(r.reference.revenue, 12000);
  assert.equal(r.requiredRevenue, 4000);
  assert.equal(r.remainingMonths, 1);
  assert.equal(r.previousFullYear.revenue, 9600);
  assert.equal(r.reference.operatingProfit, 1200);
  assert.equal(fiscalSummary({ ...s, outlook: null }).requiredRevenue, null);
});
test("missing months, partial current months, mismatched prior figures and unbalanced sources fail closed", () => {
  for (const bad of [
    { ...input, months: input.months.slice(1) },
    {
      ...input,
      months: [...input.months, { ...input.months[0], period: "2026-10" }],
    },
    {
      ...input,
      months: input.months.map((m, i) =>
        i ? m : { ...m, monthly: { ...m.monthly, operatingProfit: 101 } },
      ),
    },
    { ...input, previousFiscalYear: input.previousFiscalYear.slice(1) },
    { ...input, outlook: { ...input.outlook, targetRevenue: -1 } },
  ])
    assert.equal(fiscalSourceSchema.safeParse(bad).success, false);
});
test("owner commentary keeps business updates separate from accounting dates and preserves an unknown total school increase", () => {
  const result = fiscalSourceSchema.parse({
    ...input,
    managementSummary: mockManagementSummary,
  });
  assert.deepEqual(result.managementSummary, mockManagementSummary);
  assert.equal(result.managementSummary?.schoolLaunches.totalAdded, null);
  assert.equal(result.months.at(-1)?.period, "2026-09");
  assert.equal(
    fiscalSourceSchema.safeParse({
      ...input,
      managementSummary: { ...mockManagementSummary, asOf: "2027-01-01" },
    }).success,
    false,
  );
  assert.equal(
    fiscalSourceSchema.safeParse({
      ...input,
      managementSummary: {
        ...mockManagementSummary,
        schoolLaunches: {
          ...mockManagementSummary.schoolLaunches,
          confirmed: [
            {
              ...mockManagementSummary.schoolLaunches.confirmed[0],
              period: "2024-01",
            },
          ],
        },
      },
    }).success,
    false,
  );
});
test("net school growth can be below gross launches and distinct schools can share an evidence page", () => {
  const summary = structuredClone(mockManagementSummary);
  summary.schoolLaunches.confirmed.push({
    ...summary.schoolLaunches.confirmed[0],
    name: "Mock スクールB",
  });
  for (const netChange of [0, -1]) {
    const source = fiscalSourceSchema.parse({
      ...input,
      managementSummary: {
        ...summary,
        schoolLaunches: { ...summary.schoolLaunches, totalAdded: netChange },
      },
    });
    assert.equal(
      source.managementSummary?.schoolLaunches.totalAdded,
      netChange,
    );
    assert.equal(source.managementSummary?.schoolLaunches.confirmed.length, 2);
  }
});
