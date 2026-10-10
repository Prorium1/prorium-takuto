"use client";
import { useActionState } from "react";
import Link from "next/link";
import { promoteFreeeStageAction, promoteFreeePendingAction } from "@/app/freee-actions";
import { periodLabel } from "@/lib/domain/finance";

export function FreeePromoteForm({ id, period, cashAccountIds }: { id: string; period: string; cashAccountIds: number[] }) {
  const [state, action, pending] = useActionState(promoteFreeeStageAction, {});
  const [pendingState, pendingAction, creating] = useActionState(promoteFreeePendingAction, {});
  return (
    <details className="reflection-extra">
      <summary>{periodLabel(period)}を非公開の下書きへ反映</summary>
      <p className="admin-info">固定費や増減理由は、下書きを作った後に入力できます。未入力の間はレビュー・承認・公開へ進めません。</p>
      <form action={pendingAction} className="freee-pending-form">
        <input type="hidden" name="stageId" value={id} />
        <p className="admin-info">freeeの現預金候補の勘定科目ID: {cashAccountIds.join("、")}。対象科目と月次締めを確認してください。</p>
        <label><input type="checkbox" name="confirmClose" required /> この月の会計処理が締まり、月次実績として使えることを確認しました</label><br />
        <label><input type="checkbox" name="confirmCategory" required /> 売上・営業利益・経常利益のfreee区分を確認しました</label><br />
        <label><input type="checkbox" name="confirmCash" required /> 現預金に含める勘定科目と残高を確認しました</label><br />
        <button className="button primary" disabled={creating}>会計確認済みの数値で下書きを作成</button>
        {pendingState.error && <p className="form-error" role="alert">{pendingState.error}</p>}
        {pendingState.success && <p className="form-success" role="status">{pendingState.success} {pendingState.reportId && <Link href={`/admin/reports/${pendingState.reportId}`}>下書きを開く →</Link>}</p>}
      </form>
      <p className="freee-promote-divider">固定費・増減理由も確認済みなら、まとめて入力して作成</p>
      <form action={action}>
        <input type="hidden" name="stageId" value={id} />
        <p className="admin-info">freeeの現預金候補の勘定科目ID: {cashAccountIds.join("、")}。freeeの残高試算表で対象科目と金額を照合してください。</p>
        <div className="form-field"><label htmlFor={`fixed-${id}`}>確認済み月次固定費（円）</label><input id={`fixed-${id}`} type="number" name="monthlyFixedCosts" min="0" step="1" required /></div>
        <div className="form-field"><label htmlFor={`revenue-reason-${id}`}>売上が前年同月から変わった理由</label><textarea id={`revenue-reason-${id}`} name="revenueReason" minLength={10} maxLength={1000} required rows={3} /></div>
        <div className="form-field"><label htmlFor={`profit-reason-${id}`}>営業利益が前年同月から変わった理由</label><textarea id={`profit-reason-${id}`} name="profitReason" minLength={10} maxLength={1000} required rows={3} /></div>
        <label><input type="checkbox" name="confirmClose" required /> この月の会計処理が締まり、月次実績として使えることを確認しました</label><br />
        <label><input type="checkbox" name="confirmCategory" required /> 売上・営業利益・経常利益のfreee区分を確認しました</label><br />
        <label><input type="checkbox" name="confirmCash" required /> 現預金に含める勘定科目と残高を確認しました</label><br />
        <button className="button primary" disabled={pending}>確認して下書きを作成</button>
        {state.error && <p className="form-error" role="alert">{state.error}</p>}
        {state.success && <p className="form-success" role="status">{state.success} {state.reportId && <Link href={`/admin/reports/${state.reportId}`}>下書きを開く →</Link>}</p>}
      </form>
    </details>
  );
}
