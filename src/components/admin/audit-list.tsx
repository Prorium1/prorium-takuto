import type { AuditEvent } from "@/lib/domain/types";
export function AuditList({ events }: { events: AuditEvent[] }) {
  return (
    <div>
      {events.length === 0 && (
        <p className="admin-info">監査イベントはまだありません。</p>
      )}
      {events.slice(0, 20).map((event) => (
        <div key={event.id} className="audit-event">
          <span>{event.action}</span>
          <div>
            <strong>{event.detail}</strong>
            <small>
              {new Date(event.at).toLocaleString("ja-JP", {
                timeZone: "Asia/Tokyo",
              })}{" "}
              JST · {event.actorId}
            </small>
          </div>
        </div>
      ))}
    </div>
  );
}
