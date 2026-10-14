import test from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { KpiGrid } from "../src/components/report/kpi";
import { augustReport } from "../src/lib/mock/seed";
import { InvestorDashboard } from "../src/components/investor-dashboard";

test("KPIの丸め前の値と前年値・差額を画面上で確認できる", () => {
  const financial = structuredClone(augustReport.content.financial);
  financial.revenue = { current: 12345678, previous: 10000000, status: "成長" };
  const html = renderToStaticMarkup(createElement(KpiGrid, { financial }));
  assert.match(html, /数値の根拠/);
  assert.match(html, /12,345,678円/);
  assert.match(html, /10,000,000円/);
  assert.match(html, /\+2,345,678円/);
});

test("単月算定を確認できないfreee実データを単月実績と表示しない", () => {
  const financial = structuredClone(augustReport.content.financial);
  financial.isMock = false;
  financial.source = "freee";
  delete financial.plBasis;
  const html = renderToStaticMarkup(createElement(KpiGrid, { financial }));
  assert.match(html, /集計基準の確認待ち/);
  assert.doesNotMatch(html, /単月実績/);
});

test("管理者に渡した一覧でも投資家ダッシュボードに未公開の数字・文章は出ない", () => {
  const draft = structuredClone(augustReport);
  draft.state = "draft";
  draft.period = "2026-09";
  draft.content.summary.headline = "PRIVATE-DRAFT-CANARY";
  draft.content.financial.revenue.current = 987654321;
  const reports = [draft, augustReport];
  const before = JSON.stringify(reports);
  const html = renderToStaticMarkup(
    createElement(InvestorDashboard, { reports }),
  );
  assert.match(html, /2026年8月/);
  assert.doesNotMatch(html, /PRIVATE-DRAFT-CANARY|987,654,321/);
  assert.equal(JSON.stringify(reports), before);
  const empty = renderToStaticMarkup(
    createElement(InvestorDashboard, { reports: [draft] }),
  );
  assert.match(empty, /月次レポートはまだ公開/);
  assert.doesNotMatch(empty, /kpi-card|PRIVATE-DRAFT-CANARY/);
});
