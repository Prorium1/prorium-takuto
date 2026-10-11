"use client";
import { useActionState } from "react";
import { correctFreeeMonthAction } from "@/app/freee-actions";
import type { ReportVersion } from "@/lib/domain/types";
export function MonthlyBasisCorrection({ report }: { report: ReportVersion }) {
  const [state, action, pending] = useActionState(correctFreeeMonthAction, {});
  return (
    <section className="admin-panel">
      <div className="panel-heading">
        <h2>単月の数値へ修正が必要です</h2>
        <span>会計基準の確認</span>
      </div>
      <p className="admin-info">
        以前の取得値は期首からの累計でした。川上さん専用の月次経営レビューで単月（期末残高−期首残高）を確認し、新しいSnapshotへ修正してください。修正が済むまでレビュー・公開には進めません。
      </p>
      <a
        className="button secondary"
        href={`https://dashboard.prorium.co.jp/executive/${report.period}`}
        target="_blank"
        rel="noopener noreferrer"
      >
        単月の分析を確認
      </a>
      <form action={action} className="admin-form">
        <input type="hidden" name="id" value={report.id} />
        <input type="hidden" name="revision" value={report.revision} />
        <label className="check-label">
          <input type="checkbox" name="confirm" required />{" "}
          単月の売上・利益と前年同月の数値を確認しました。
        </label>
        <button className="button primary" disabled={pending}>
          単月の数値でSnapshotを修正
        </button>
        {state.error && (
          <p role="alert" className="form-error">
            {state.error}
          </p>
        )}
        {state.success && <p role="status">{state.success}</p>}
      </form>
    </section>
  );
}
