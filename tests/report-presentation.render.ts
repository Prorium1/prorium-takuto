import test from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { TrendChart } from "../src/components/report/trend-chart";
import { DriverBridge } from "../src/components/report/driver-bridge";
import { KpiGrid } from "../src/components/report/kpi";
import { ReportView } from "../src/components/report/report-view";
import { augustReport } from "../src/lib/mock/seed";
import { ExecutiveSummary } from "../src/components/report/executive-summary";

const financial = () => structuredClone(augustReport.content.financial);

test("executive overview separates outlook and risk and leaves the published content unchanged", () => {
  const report = structuredClone(augustReport);
  const before = JSON.stringify(report);
  const html = renderToStaticMarkup(
    createElement(ExecutiveSummary, { report }),
  );
  assert.match(html, /NEXT · 見通し・予定/);
  assert.match(html, /WATCH · リスクと対応/);
  assert.match(html, /href="#drivers"/);
  assert.match(html, /href="#ai"/);
  assert.equal(JSON.stringify(report), before);
  report.content.risks = [];
  report.content.summary.outlook = "";
  const empty = renderToStaticMarkup(
    createElement(ExecutiveSummary, { report }),
  );
  assert.match(empty, /リスクがないことを意味しません/);
  assert.match(empty, /見通しはまだ掲載されていません/);
});

test("zero and singleton histories render finite chart geometry", () => {
  for (const count of [1, 2, 6]) {
    const f = financial();
    f.trend = f.trend.slice(-count).map((p) => ({
      ...p,
      revenue: 0,
      previousRevenue: 0,
      profit: 0,
      previousProfit: 0,
    }));
    const html = renderToStaticMarkup(
      createElement(TrendChart, { financial: f }),
    );
    assert.doesNotMatch(html, /NaN|Infinity/);
  }
});

test("empty histories show an explicit empty state instead of throwing", () => {
  const f = financial();
  f.trend = [];
  const html = renderToStaticMarkup(
    createElement(TrendChart, { financial: f }),
  );
  assert.match(html, /推移データは未掲載/);
});

test("negative chart values stay inside the plot and declines are styled as declines", () => {
  const f = financial();
  f.trend = f.trend.map((p) => ({
    ...p,
    revenue: -2_000_000,
    previousRevenue: 3_000_000,
  }));
  const html = renderToStaticMarkup(
    createElement(TrendChart, { financial: f }),
  );
  const coordinates = [...html.matchAll(/cy="([^"]+)"/g)].map((m) =>
    Number(m[1]),
  );
  assert.ok(coordinates.length > 0);
  assert.ok(
    coordinates.every((y) => Number.isFinite(y) && y >= 32 && y <= 222),
  );
  assert.match(html, /class="negative"/);
  assert.match(html, /lucide-arrow-down-right/);
});

test("zero and negative prior years display a signed delta with a comparison explanation", () => {
  for (const previous of [0, -1_000_000]) {
    const f = financial();
    f.trend = f.trend.map((p) => ({
      ...p,
      revenue: 2_000_000,
      previousRevenue: previous,
    }));
    f.revenue = { current: 2_000_000, previous, status: "改善" };
    const chart = renderToStaticMarkup(
      createElement(TrendChart, { financial: f }),
    );
    const kpi = renderToStaticMarkup(createElement(KpiGrid, { financial: f }));
    const expectedDelta = previous === 0 ? "+2.00百万円" : "+3.00百万円";
    assert.ok(chart.includes(expectedDelta));
    assert.ok(kpi.includes(expectedDelta));
    assert.match(chart, /前年同月が0以下のため増減額/);
    assert.match(kpi, /前年同月が0以下のため増減額/);
  }
});

test("driver bridges label negative deltas correctly and handle zero contributions", () => {
  const down = renderToStaticMarkup(
    createElement(DriverBridge, {
      title: "営業利益変化",
      previous: 2_000_000,
      current: 1_000_000,
      drivers: [
        { label: "先行投資", amount: -1_000_000, description: "開発費" },
      ],
    }),
  );
  assert.doesNotMatch(down, /\+-/);
  assert.match(down, /driver-header[\s\S]*?class="negative"/);
  const flat = renderToStaticMarkup(
    createElement(DriverBridge, {
      title: "営業利益変化",
      previous: 1_000_000,
      current: 1_000_000,
      drivers: [
        { label: "変化なし", amount: 0, description: "前年同月と同額" },
      ],
    }),
  );
  assert.doesNotMatch(flat, /NaN|Infinity/);
});

test("non-mock chart data is not labeled as mock", () => {
  const f = financial();
  f.isMock = false;
  f.source = "management-entry";
  assert.doesNotMatch(
    renderToStaticMarkup(createElement(TrendChart, { financial: f })),
    /Mock Data/,
  );
});

test("summary and provenance identify mock analysis without claiming live AI assistance", () => {
  const html = renderToStaticMarkup(
    createElement(ReportView, { report: augustReport }),
  );
  const summaryBadge = html.match(
    /class="ai-badge"[^>]*>([\s\S]*?)<\/span>/,
  )?.[1];
  assert.match(summaryBadge ?? "", /Mock analysis/);
  assert.doesNotMatch(summaryBadge ?? "", /AI assisted/);
});

test("source and JST update time remain in the overview before financial detail", () => {
  const html = renderToStaticMarkup(
    createElement(ReportView, { report: augustReport }),
  );
  const top = html.split('id="performance"')[0];
  assert.match(top, /Synthetic freee fixture/);
  assert.match(top, /2026\/09\/05 10:30 JST/);
  assert.match(top, /freee未接続/);
});

test("live AI generation remains visible after human approval", () => {
  const report = structuredClone(augustReport);
  report.content.financial.isMock = false;
  report.content.financial.source = "management-entry";
  report.analysis = "generated-ai";
  const html = renderToStaticMarkup(createElement(ReportView, { report }));
  const summaryBadge = html.match(
    /class="ai-badge"[^>]*>([\s\S]*?)<\/span>/,
  )?.[1];
  assert.match(summaryBadge ?? "", /AI assisted/);
  assert.match(summaryBadge ?? "", /Human approved/);
  const top = html.split('id="performance"')[0];
  assert.match(top, /管理者入力/);
  assert.doesNotMatch(top, /自動同期済み|Synced automatically/);
});
