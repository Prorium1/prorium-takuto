import test from "node:test";
import assert from "node:assert/strict";
import { eventVideo } from "../src/lib/domain/event-video";
import { eventSpotlightSchema } from "../src/lib/domain/validation";

test("event video accepts explicit providers and strips tracking parameters", () => {
  const youtube = eventVideo("https://youtu.be/abcdefghijk?si=tracking");
  assert.equal(youtube?.watch, "https://www.youtube.com/watch?v=abcdefghijk");
  assert.equal(new URL(youtube!.embed).hostname, "www.youtube-nocookie.com");
  assert.equal(
    eventVideo("https://vimeo.com/123456/abcdef")?.embed,
    "https://player.vimeo.com/video/123456?dnt=1&autoplay=1&h=abcdef",
  );
  for (const url of [
    "javascript:alert(1)",
    "http://youtu.be/abcdefghijk",
    "https://youtube.com.evil.example/watch?v=abcdefghijk",
    "https://user:pass@youtu.be/abcdefghijk",
    "https://youtu.be:444/abcdefghijk",
    "https://youtu.be/short",
    "https://example.com/video.mp4",
  ])
    assert.equal(eventVideo(url), null, url);
});

test("event editorial validation requires a real date and named video", () => {
  const event = {
    title: "Synthetic event",
    occurredOn: "2026-06-02",
    summary: "Synthetic summary",
    outcomes: [],
    nextAction: "",
    videoUrl: "",
    videoTitle: "",
  };
  assert.equal(eventSpotlightSchema.parse(event).title, event.title);
  assert.throws(() =>
    eventSpotlightSchema.parse({ ...event, occurredOn: "2026-02-30" }),
  );
  assert.throws(() =>
    eventSpotlightSchema.parse({
      ...event,
      videoUrl: "https://youtu.be/abcdefghijk",
    }),
  );
  assert.equal(
    eventSpotlightSchema.parse({
      ...event,
      videoUrl: "https://youtu.be/abcdefghijk?si=tracking",
      videoTitle: "Synthetic video",
    }).videoUrl,
    "https://www.youtube.com/watch?v=abcdefghijk",
  );
});
