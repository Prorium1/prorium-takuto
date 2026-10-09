import test from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { EventSpotlight } from "../src/components/report/event-spotlight";

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
  const screen = renderToStaticMarkup(
    createElement(EventSpotlight, { event, period: "2026-08", print: false }),
  );
  assert.match(screen, /過去開催の振り返り/);
  assert.match(screen, /2026年6月2日/);
  assert.match(screen, /クリックして再生/);
  assert.doesNotMatch(screen, /<iframe/);
  const printed = renderToStaticMarkup(
    createElement(EventSpotlight, { event, period: "2026-08", print: true }),
  );
  assert.match(printed, /https:\/\/www.youtube.com\/watch\?v=abcdefghijk/);
  assert.doesNotMatch(printed, /<iframe/);
});
