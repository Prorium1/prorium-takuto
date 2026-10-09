import test from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { FreeeStagedReview } from "../src/components/admin/freee-staged-review";

test("staged finance labels incomplete month and blocks implied publication", () => {
  const html = renderToStaticMarkup(createElement(FreeeStagedReview, { rows: [{
    id: "11111111-1111-4111-8111-111111111111",
    period: "2026-10",
    candidate: {
      completeness: "month-to-date", throughDate: "2026-10-09",
      revenue: { current: 1000, previous: 800 },
      operatingProfit: { current: 100, previous: 50 },
      ordinaryProfit: { current: 90, previous: 40 },
      cash: { current: 2000, previous: 1700 },
    },
    provenance: { closeConfirmed: false, retrievedAt: "2026-10-09T00:00:00Z" },
  }] }));
  assert.match(html, /2026-10-09まで · 参考値/);
  assert.match(html, /株主レポートにも公開済みSnapshotにも反映されていません/);
  assert.match(html, /管理者のみ/);
});
