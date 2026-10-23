import test from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { FiscalBriefing } from "../src/components/report/fiscal-briefing";
import { mockFiscalSource } from "../src/lib/mock/fiscal";
test("fiscal presentation separates management target, unknown forecasts, reference scenario and closing evidence", () => {
  const html = renderToStaticMarkup(
    createElement(FiscalBriefing, {
      source: mockFiscalSource(2026),
      ownership: null,
      mock: true,
    }),
  );
  assert.match(html, /2025年11月/);
  assert.match(html, /600,000,000円/);
  assert.match(html, /経営者の着地予想/);
  assert.match(html, /未確認/);
  assert.match(html, /累計実績＋実績未取得1/);
  assert.match(html, /仮締め/);
  assert.match(html, /未締め/);
  assert.match(html, /前期実績/);
  assert.match(html, /販管費の増減/);
  assert.match(html, /売上高の12か月単月推移/);
  assert.match(html, /架空データ/);
  assert.doesNotMatch(html, /経営確認済み|AIによる効率化|PRIVATE-/);
});
