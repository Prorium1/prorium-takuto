import type { ReportContent } from "@/lib/domain/types";
import { EventVideo } from "./event-video";
import { eventVideo } from "@/lib/domain/event-video";

export function EventSpotlight({
  event,
  period,
  print,
}: {
  event: NonNullable<ReportContent["eventSpotlight"]>;
  period: string;
  print: boolean;
}) {
  const date = new Date(
    `${event.occurredOn}T00:00:00+09:00`,
  ).toLocaleDateString("ja-JP", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  const video = eventVideo(event.videoUrl);
  return (
    <section
      id="event"
      className="event-spotlight"
      aria-labelledby="event-title"
    >
      <div className="event-masthead">
        <span>FIELD REPORT</span>
        <span>
          {event.occurredOn.slice(0, 7) === period
            ? "当月開催"
            : "過去開催の振り返り"}{" "}
          · {date}
        </span>
      </div>
      <div className="event-layout">
        <div className="event-editorial">
          <span className="event-kicker">現場の熱量を、次の成長へ。</span>
          <h2 id="event-title">{event.title}</h2>
          <p>{event.summary}</p>
        </div>
        {video && !print ? (
          <EventVideo url={event.videoUrl} title={event.videoTitle} />
        ) : (
          <div className="event-date-art" aria-hidden="true">
            <span>{event.occurredOn.slice(0, 4)} / EVENT</span>
            <strong>{event.occurredOn.slice(5).replace("-", ".")}</strong>
            <i />
            <span>EXPERIENCE → INSIGHT → ACTION</span>
          </div>
        )}
      </div>
      {event.outcomes.length > 0 && (
        <ol className="event-outcomes">
          {event.outcomes.map((outcome, i) => (
            <li key={i}>
              <span>{String(i + 1).padStart(2, "0")}</span>
              <p>{outcome}</p>
            </li>
          ))}
        </ol>
      )}
      {event.nextAction && (
        <div className="event-next">
          <span>NEXT ACTION</span>
          <p>{event.nextAction}</p>
        </div>
      )}
      {print && video && (
        <p className="event-print-video">
          動画：{event.videoTitle} — {video.watch}
        </p>
      )}
    </section>
  );
}
