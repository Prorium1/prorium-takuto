import Link from "next/link";
import type { ReportPreparation } from "@/lib/domain/report-preparation";
import { preparationLabel } from "@/lib/domain/report-preparation";
import { periodLabel } from "@/lib/domain/finance";
export function ReportPreparationPanel({
  reports,
  published,
}: {
  reports: ReportPreparation[];
  published: boolean;
}) {
  const latest = reports[0];
  return (
    <aside className="portal-admin-panel" aria-labelledby="portal-admin-title">
      <div>
        <span className="portal-chip">管理者だけに表示</span>
        <h2 id="portal-admin-title">ここは株主に見える画面です</h2>
        <p>
          {published
            ? "下記は株主と同じ公開済みの画面です。未公開の変更は編集画面で確認できます。"
            : "株主向けの報告はまだ公開されていません。内容の確認・公開は、経営者のホームから進められます。"}
        </p>
        {latest && published && (
          <p>
            <strong>
              {periodLabel(latest.period)} · {latest.version}
            </strong>
            　{preparationLabel(latest)}
          </p>
        )}
      </div>
      <div className="portal-admin-actions">
        <Link className="button primary" href="/admin">
          経営者のホームに戻る
        </Link>
      </div>
    </aside>
  );
}
