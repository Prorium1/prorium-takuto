import test from "node:test";
import assert from "node:assert/strict";
import { presentationSourceSchema } from "../src/lib/domain/presentation";

const metrics = {
  revenue: 1000,
  costOfSales: 200,
  grossProfit: 800,
  sga: 900,
  operatingProfit: -100,
  ordinaryProfit: -90,
};
export const presentationFixture = {
  period: "2026-08",
  basis: "monthly-net-v2",
  retrievedAt: "2026-09-05T01:30:00Z",
  monthly: metrics,
  previousYear: {
    ...metrics,
    revenue: 800,
    grossProfit: 600,
    operatingProfit: -300,
    ordinaryProfit: -290,
  },
  bsTotals: {
    assets: 5000,
    liabilities: 4000,
    equity: 1000,
    cash: 2000,
    currentAssets: 3000,
    currentLiabilities: 2000,
  },
  trend: [
    {
      period: "2026-08",
      retrievedAt: "2026-09-05T01:30:00Z",
      revenue: 1000,
      previousRevenue: 800,
      profit: -100,
      previousProfit: -300,
    },
  ],
};
test("presentation data rejects unbalanced P/L and B/S, stale basis and inconsistent trend", () => {
  assert.equal(
    presentationSourceSchema.safeParse(presentationFixture).success,
    true,
  );
  for (const bad of [
    { ...presentationFixture, basis: "closing-balance" },
    { ...presentationFixture, monthly: { ...metrics, grossProfit: 801 } },
    {
      ...presentationFixture,
      bsTotals: { ...presentationFixture.bsTotals, equity: 999 },
    },
    {
      ...presentationFixture,
      trend: [{ ...presentationFixture.trend[0], revenue: 999 }],
    },
    {
      ...presentationFixture,
      trend: [{ ...presentationFixture.trend[0], period: "2026-09" }],
    },
    { ...presentationFixture, token: "PRIVATE-CANARY" },
  ])
    assert.equal(presentationSourceSchema.safeParse(bad).success, false);
});
