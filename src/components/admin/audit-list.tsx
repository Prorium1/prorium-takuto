import type { AuditEvent } from "@/lib/domain/types";
import styles from "./audit-list.module.css";

const actions: Record<string, string> = {
  "auth.platform_code_redeemed": "プラットフォームからログイン",
  create: "下書きを作成",
  draft: "下書きを更新",
  edit: "レポートを編集",
  review: "レビューへ提出",
  approved: "レポートを承認",
  approve: "レポートを承認",
  published: "レポートを公開",
  publish: "レポートを公開",
  revision: "改訂版を作成",
  "monthly-update": "月次の振り返りを保存",
  "ai-analysis": "AI分析の下書きを生成",
  import: "財務データを取込",
  "freee-stage-promoted": "freeeの数値で下書きを作成",
  "freee-context-completed": "業績の変化の理由を入力",
  "freee-context-pending": "業績の振り返りを入力待ちに設定",
  "freee-connected": "freeeを接続",
  "pdf-export": "レポートをPDF出力",
  "document-attached": "資料を添付",
  "document-download": "資料をダウンロード",
};

function readableDetail(event: AuditEvent) {
  try {
    const metadata: unknown = JSON.parse(event.detail);
    if (!metadata || typeof metadata !== "object" || Array.isArray(metadata))
      return null;
    const values = metadata as Record<string, unknown>;
    const parts: string[] = [];
    if (
      typeof values.period === "string" &&
      /^\d{4}-\d{2}$/.test(values.period)
    )
      parts.push(values.period.replace("-", "年") + "月");
    if (
      typeof values.version === "string" &&
      /^v\d+\.\d+$/.test(values.version)
    )
      parts.push(values.version);
    if (Number.isSafeInteger(values.revision))
      parts.push(`更新 ${values.revision}`);
    return parts.length ? parts.join(" · ") : null;
  } catch {
    return event.detail || null;
  }
}

export function AuditList({ events }: { events: AuditEvent[] }) {
  return (
    <div className={styles.list}>
      {events.length === 0 && (
        <p className="admin-info">監査イベントはまだありません。</p>
      )}
      {events.slice(0, 20).map((event) => {
        const detail = readableDetail(event);
        return (
          <article key={event.id} className={styles.event}>
            <h3>{actions[event.action] || "管理操作を記録"}</h3>
            <time dateTime={event.at}>
              {new Date(event.at).toLocaleString("ja-JP", {
                timeZone: "Asia/Tokyo",
                year: "numeric",
                month: "2-digit",
                day: "2-digit",
                hour: "2-digit",
                minute: "2-digit",
                hour12: false,
              })}{" "}
              JST
            </time>
            {detail && <p>{detail}</p>}
            <details className={styles.details}>
              <summary>記録の詳細</summary>
              <dl>
                <div>
                  <dt>操作</dt>
                  <dd>{event.action}</dd>
                </div>
                <div>
                  <dt>実行者ID</dt>
                  <dd>{event.actorId}</dd>
                </div>
              </dl>
              <pre>{event.detail}</pre>
            </details>
          </article>
        );
      })}
      {events.length > 20 && (
        <p className={styles.note}>直近20件の操作を表示しています。</p>
      )}
    </div>
  );
}
