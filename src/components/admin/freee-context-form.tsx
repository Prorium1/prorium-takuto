"use client";
import { useActionState } from "react";
import { completeFreeeContextAction } from "@/app/freee-actions";
import type { ReportVersion } from "@/lib/domain/types";

export function FreeeContextForm({ report }: { report: ReportVersion }) {
  const [state, action, pending] = useActionState(completeFreeeContextAction, {});
  return (
    <section className="admin-panel freee-context-form">
      <div className="panel-heading"><h2>公開前に必要な経営者の説明</h2><span className="badge badge-neutral">非公開 · 入力待ち</span></div>
      <p className="admin-info">freeeの数値は非公開下書きに入っています。固定費と、売上・営業利益が前年同月から変わった理由を入力するとレビューに進めます。原因を会計数値から推測して自動補完しません。</p>
      <form action={action} className="create-form">
        <input type="hidden" name="id" value={report.id} />
        <input type="hidden" name="revision" value={report.revision} />
        <div className="form-field"><label htmlFor="freee-context-fixed">確認済み月次固定費（円）</label><input id="freee-context-fixed" type="number" name="monthlyFixedCosts" min="0" step="1" required /></div>
        <div className="form-field"><label htmlFor="freee-context-revenue">売上が前年同月から変わった理由</label><textarea id="freee-context-revenue" name="revenueReason" minLength={10} maxLength={900} required rows={3} /></div>
        <div className="form-field"><label htmlFor="freee-context-profit">営業利益が前年同月から変わった理由</label><textarea id="freee-context-profit" name="profitReason" minLength={10} maxLength={900} required rows={3} /></div>
        <button className="button primary" disabled={pending}>{pending ? "保存中…" : "経営者の説明を保存"}</button>
        {state.error && <p className="form-error" role="alert">{state.error}</p>}
        {state.success && <p className="form-success" role="status">{state.success}</p>}
      </form>
    </section>
  );
}
