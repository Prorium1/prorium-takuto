import test from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { InvestorDashboard } from "../src/components/investor-dashboard";

test("公開0件でも3つの閲覧目的と準備中の理由がわかる", () => {
  const html = renderToStaticMarkup(
    createElement(InvestorDashboard, { reports: [] }),
  );
  assert.match(html, /月次レポート/);
  assert.match(html, /財務資料・PDF/);
  assert.match(html, /株主構成/);
  assert.match(html, /まだ公開されていません/);
  assert.doesNotMatch(html, /kpi-card|\/admin\/|0円/);
});
