import test from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { FiscalBriefing } from "../src/components/report/fiscal-briefing";
import { mockFiscalSource } from "../src/lib/mock/fiscal";
import { mockManagementSummary } from "../src/lib/mock/fiscal-summary";
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
test("financial amounts use full yen and the owner's four-part business summary is visible without implying publication", () => {
  const source = {
    ...mockFiscalSource(2026),
    managementSummary: mockManagementSummary,
  };
  const html = renderToStaticMarkup(
    createElement(FiscalBriefing, { source, ownership: null, mock: true }),
  );
  assert.match(html, /434,500,000円/);
  assert.match(html, /今期の経営サマリー/);
  assert.match(html, /資金面/);
  assert.match(html, /事業の進捗/);
  assert.match(html, /業務効率化と新規展開/);
  assert.match(html, /今後の展望/);
  assert.match(html, /Mock スクールA/);
  assert.match(html, /全体の純増は確認中/);
  assert.match(html, /数値化したAI効果/);
  assert.doesNotMatch(html, /百万円|6億円|経営承認済み/);
});
