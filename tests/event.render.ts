import test from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { EventSpotlight } from "../src/components/report/event-spotlight";
import { ReportView } from "../src/components/report/report-view";
import { augustReport } from "../src/lib/mock/seed";
import { ImageConfigContext } from "next/dist/shared/lib/image-config-context.shared-runtime";
import { imageConfigDefault } from "next/dist/shared/lib/image-config";
import nextConfig from "../next.config";

function renderWithImageConfig(element: ReturnType<typeof createElement>) {
  return renderToStaticMarkup(
    createElement(
      ImageConfigContext.Provider,
      { value: { ...imageConfigDefault, ...nextConfig.images } },
      element,
    ),
  );
}

const event = {
  title: "Synthetic event",
  occurredOn: "2026-06-02",
  summary: "Synthetic summary",
  outcomes: ["Synthetic outcome"],
  nextAction: "Synthetic next action",
  videoUrl: "https://www.youtube.com/watch?v=abcdefghijk",
  videoTitle: "Synthetic video",
};
test("event video waits for viewer interaction and print retains viewing link", () => {
  const screen = renderWithImageConfig(
    createElement(EventSpotlight, { event, period: "2026-08", print: false }),
  );
  assert.match(screen, /過去開催の振り返り/);
  assert.match(screen, /2026年6月2日/);
  assert.match(screen, /クリックして再生/);
  assert.doesNotMatch(screen, /<iframe/);
  assert.match(screen, /src="\/_next\/image\?/);
  assert.doesNotMatch(screen, /src="https:\/\/i.ytimg.com/);
  const printed = renderToStaticMarkup(
    createElement(EventSpotlight, { event, period: "2026-08", print: true }),
  );
  assert.match(printed, /https:\/\/www.youtube.com\/watch\?v=abcdefghijk/);
  assert.doesNotMatch(printed, /<iframe/);
});

test("film entry leads to the field report before financial detail without changing the snapshot", () => {
  const report = structuredClone(augustReport);
  report.content.eventSpotlight = event;
  const before = JSON.stringify(report);
  const html = renderWithImageConfig(createElement(ReportView, { report }));
  assert.match(html, /現場の映像を見る/);
  assert.ok(html.indexOf('id="event"') < html.indexOf('id="performance"'));
  assert.equal((html.match(/id="event"/g) || []).length, 1);
  assert.equal(JSON.stringify(report), before);
  const print = renderToStaticMarkup(
    createElement(ReportView, { report, print: true }),
  );
  assert.ok(print.indexOf('id="event"') > print.indexOf('id="business"'));
  assert.doesNotMatch(print, /現場の映像を見る/);
});
