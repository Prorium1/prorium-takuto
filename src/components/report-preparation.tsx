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
        <h2 id="portal-admin-title">株主への公開準備</h2>
        <p>
          {published
            ? "下記は株主と同じ公開済みの画面です。未公開の変更は編集画面で確認できます。"
            : "画面の更新は反映されています。まだレポートを公開していないため、株主向けの数値は表示されていません。"}
        </p>
        {latest && (
          <p>
            <strong>
              {periodLabel(latest.period)} · {latest.version}
            </strong>
            　{preparationLabel(latest)}
          </p>
        )}
      </div>
      <div className="portal-admin-actions">
        <Link
          className="button primary"
          href={latest ? `/admin/reports/${latest.id}` : "/admin/reports"}
        >
          {latest
            ? `${periodLabel(latest.period)}の下書きを仕上げる`
            : "月次レポートを作成"}
        </Link>
        <Link href="/admin/shareholders">株主構成を登録する →</Link>
        <p>入力 → 内容を確認 → 承認・公開</p>
      </div>
    </aside>
  );
}
