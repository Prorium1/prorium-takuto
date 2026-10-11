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
        <span>
          FIELD NOTES{" "}
          <span className="event-masthead-jp">/ 大会・イベント</span>
        </span>
        <span>
          {event.occurredOn.slice(0, 7) === period
            ? "当月開催"
            : "過去開催の振り返り"}{" "}
          · {date}
        </span>
      </div>
      <div className="event-layout">
        <div className="event-media">
          {video && !print ? (
            <EventVideo url={event.videoUrl} title={event.videoTitle} />
          ) : (
            <div className="event-date-art" aria-hidden="true">
              <span>{event.occurredOn.slice(0, 4)} / EVENT REVIEW</span>
              <strong>{event.occurredOn.slice(5).replace("-", ".")}</strong>
              <i />
              <span>現場の記録を、次の一歩へ。</span>
            </div>
          )}
        </div>
        <div className="event-editorial">
          <span className="event-kicker">映像とともに、現場を振り返る。</span>
          <h2 id="event-title">{event.title}</h2>
          <span className="event-summary-label">開催概要</span>
          <p>{event.summary}</p>
        </div>
      </div>
      {event.outcomes.length > 0 && (
        <div className="event-results">
          <h3>
            確認済みの成果 <span>VERIFIED OUTCOMES</span>
          </h3>
          <ol className="event-outcomes">
            {event.outcomes.map((outcome, i) => (
              <li key={i}>
                <span>{String(i + 1).padStart(2, "0")}</span>
                <p>{outcome}</p>
              </li>
            ))}
          </ol>
        </div>
      )}
      {!event.outcomes.length && (
        <p className="event-pending-outcomes">
          成果・事業への寄与は、確認後に追記します。
        </p>
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
