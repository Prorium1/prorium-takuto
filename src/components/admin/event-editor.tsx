"use client";
import type { ReportContent } from "@/lib/domain/types";

type Event = NonNullable<ReportContent["eventSpotlight"]>;
export function EventEditor({
  event,
  onChange,
}: {
  event: Event | null;
  onChange: (value: Event | null) => void;
}) {
  const update = (patch: Partial<Event>) =>
    event && onChange({ ...event, ...patch });
  return (
    <section className="editor-section">
      <h2>大会・イベントのサマリー</h2>
      <p>
        開催日、成果、次の施策を記録します。過去の大会は開催月を明示して表示します。
      </p>
      {!event ? (
        <button
          type="button"
          className="button secondary"
          onClick={() =>
            onChange({
              title: "",
              occurredOn: "",
              summary: "",
              outcomes: [],
              nextAction: "",
              videoUrl: "",
              videoTitle: "",
            })
          }
        >
          イベントレポートを追加
        </button>
      ) : (
        <>
          <div className="field-row">
            <label>
              大会・イベント名
              <input
                value={event.title}
                required
                maxLength={120}
                onChange={(e) => update({ title: e.target.value })}
              />
            </label>
            <label>
              開催日（複数日の場合は初日）
              <input
                type="date"
                value={event.occurredOn}
                required
                onChange={(e) => update({ occurredOn: e.target.value })}
              />
            </label>
          </div>
          <label>
            開催概要・事業上の意味
            <textarea
              value={event.summary}
              required
              maxLength={2000}
              onChange={(e) => update({ summary: e.target.value })}
            />
          </label>
          <label>
            確認済みの成果（1行に1件・最大4件）
            <textarea
              value={event.outcomes.join("\n")}
              onChange={(e) => update({ outcomes: e.target.value.split("\n") })}
            />
          </label>
          <label>
            次につなげる施策
            <textarea
              value={event.nextAction}
              maxLength={500}
              onChange={(e) => update({ nextAction: e.target.value })}
            />
          </label>
          <div className="field-row">
            <label>
              掲載許可のある動画URL（任意）
              <input
                type="url"
                value={event.videoUrl}
                placeholder="https://youtu.be/… または https://vimeo.com/…"
                onChange={(e) => update({ videoUrl: e.target.value })}
              />
            </label>
            <label>
              動画タイトル
              <input
                value={event.videoTitle}
                required={!!event.videoUrl}
                maxLength={120}
                onChange={(e) => update({ videoTitle: e.target.value })}
              />
            </label>
          </div>
          <p>
            再生ボタンを押したときだけYouTube・Vimeoへ接続します。限定公開動画のURLはIRログインと連動しないため、共有してよい動画だけを指定してください。
          </p>
          <button
            type="button"
            className="remove-button"
            onClick={() => onChange(null)}
          >
            このイベントを掲載しない
          </button>
        </>
      )}
    </section>
  );
}
