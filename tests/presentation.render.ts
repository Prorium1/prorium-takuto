import test from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { PresentationView } from "../src/components/report/presentation-view";
import { augustReport } from "../src/lib/mock/seed";
import { presentationSourceSchema } from "../src/lib/domain/presentation";
import { ImageConfigContext } from "next/dist/shared/lib/image-config-context.shared-runtime";
import { imageConfigDefault } from "next/dist/shared/lib/image-config";
import nextConfig from "../next.config";
const source = {
  period: "2026-08",
  basis: "monthly-net-v2",
  retrievedAt: "2026-09-05T01:30:00Z",
  monthly: {
    revenue: 1000,
    costOfSales: 200,
    grossProfit: 800,
    sga: 900,
    operatingProfit: -100,
    ordinaryProfit: -90,
  },
  previousYear: {
    revenue: 800,
    costOfSales: 0,
    grossProfit: 800,
    sga: 1000,
    operatingProfit: -200,
    ordinaryProfit: -190,
  },
  bsTotals: {
    assets: 5000,
    liabilities: 4000,
    equity: 1000,
    cash: null,
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
      previousProfit: -200,
    },
  ],
};
test("owner presentation shows verified monthly facts and unknowns without approval or cash comparison claims", () => {
  const report = structuredClone(augustReport);
  report.content.ceo.message = "PRIVATE-CEO-DRAFT";
  report.content.eventSpotlight = {
    title: "PRIVATE-EVENT-TITLE",
    occurredOn: "2026-06-02",
    summary: "PRIVATE-EVENT-PROSE",
    outcomes: ["PRIVATE-EVENT-OUTCOME"],
    nextAction: "PRIVATE-EVENT-NEXT",
    videoUrl: "https://www.youtube.com/watch?v=abcdefghijk",
    videoTitle: "PRIVATE-EVENT-VIDEO-TITLE",
  };
  report.content.briefing = [
    {
      id: "private",
      topic: "development",
      kind: "Forecast",
      title: "PRIVATE-BUSINESS-DRAFT",
      body: "未承認の事業メモ",
    },
  ];
  const html = renderToStaticMarkup(
    createElement(
      ImageConfigContext.Provider,
      { value: { ...imageConfigDefault, ...nextConfig.images } },
      createElement(PresentationView, {
        source: presentationSourceSchema.parse(source),
        report,
        ownership: report.content.ownership || null,
      }),
    ),
  );
  assert.match(html, /説明用プレビュー/);
  assert.match(html, /未公開/);
  assert.match(html, /月次固定費.*未確認/s);
  assert.match(html, /前年同月の売上原価が0円/);
  assert.match(html, /現預金の比較値は未取得/);
  assert.match(html, /1,000円/);
  assert.match(html, /Mock 創業株主A/);
  assert.doesNotMatch(
    html,
    /PRIVATE-CEO-DRAFT|PRIVATE-BUSINESS-DRAFT|PRIVATE-EVENT-|経営確認済み|承認済み|AIによる効率化|か月分の現預金/,
  );
});
