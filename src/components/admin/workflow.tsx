"use client";
import { useActionState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  Check,
  Eye,
  Plus,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import {
  createReportAction,
  reportOperationAction,
  reviseReportAction,
} from "@/app/actions";
import type { ReportVersion } from "@/lib/domain/types";
import { useReportSection } from "./editing-guard";

export const stateLabels = {
  draft: "Draft",
  review: "Human Review",
  approved: "Approved",
  published: "Published",
};
export function CreateReportForm() {
  const [state, action, pending] = useActionState(createReportAction, {});
  return (
    <div>
      <form action={action} className="create-form">
        <label>
          対象月
          <input
            name="period"
            type="month"
            defaultValue={new Date().toISOString().slice(0, 7)}
            required
          />
        </label>
        <label className="checkbox-field">
          <input name="summaryOnly" type="checkbox" />
          文章とPDFで開始する
        </label>
        <button className="button primary" disabled={pending}>
          <Plus size={15} />
          {pending ? "作成中…" : "レポートを作成"}
        </button>
      </form>
      {state.error && (
        <p className="form-error create-form-state" role="alert">
          {state.error}
        </p>
      )}
    </div>
  );
}
export function RevisionForm({ id }: { id: string }) {
  const [state, action, pending] = useActionState(reviseReportAction, {});
  return (
    <div>
      <form action={action} className="revision-form">
        <input type="hidden" name="id" value={id} />
        <select aria-label="改訂の種類" name="kind" defaultValue="minor">
          <option value="minor">小改訂（Minor）</option>
          <option value="major">大改訂（Major）</option>
        </select>
        <button disabled={pending} className="button secondary">
          <Plus size={15} />
          {pending ? "作成中…" : "改訂版を作成"}
        </button>
      </form>
      {state.error && (
        <p className="form-error create-form-state" role="alert">
          {state.error}
        </p>
      )}
    </div>
  );
}
export function WorkflowControls({ report }: { report: ReportVersion }) {
  const [state, action, pending] = useActionState(reportOperationAction, {});
  const editing = useReportSection("workflow", false, pending);
  const blocked = pending || editing.dirty || editing.busy;
  const states = ["draft", "review", "approved", "published"] as const;
  const current = states.indexOf(report.state);
  return (
    <div className="workflow-card">
      <div className="workflow-steps">
        {states.map((s, i) => (
          <div
            key={s}
            className={`workflow-step ${i === current ? "current" : ""} ${i < current ? "done" : ""}`}
          >
            <i>{i < current ? <Check size={13} /> : i + 1}</i>
            <span>{stateLabels[s]}</span>
            {i < 3 && <ArrowRight size={12} />}
          </div>
        ))}
      </div>
      <div className="workflow-controls">
        {report.state !== "published" && (
          <form action={action}>
            <input type="hidden" name="id" value={report.id} />
            <input type="hidden" name="revision" value={report.revision} />
            <div className="workflow-controls">
              {report.content.financial.isMock && (
                <button
                  className="button secondary"
                  name="operation"
                  value="generate"
                  disabled={blocked}
                >
                  <Sparkles size={14} />
                  Mock AI Draftを生成
                </button>
              )}
              {report.state === "draft" && (
                <button
                  className="button primary"
                  name="operation"
                  value="review"
                  disabled={blocked}
                >
                  レビューへ提出
                  <ArrowRight size={14} />
                </button>
              )}
              {report.state === "review" && (
                <button
                  className="button primary"
                  name="operation"
                  value="approve"
                  disabled={blocked}
                >
                  <ShieldCheck size={14} />
                  内容を確認して承認
                </button>
              )}
              {report.state === "approved" && (
                <button
                  className="button purple-button"
                  name="operation"
                  value="publish"
                  disabled={blocked}
                >
                  株主へ公開
                  <ArrowRight size={14} />
                </button>
              )}
            </div>
          </form>
        )}
        {blocked ? (
          <button className="button secondary" disabled>
            <Eye size={14} />
            プレビュー
          </button>
        ) : (
          <Link
            href={`/admin/reports/${report.id}?preview=1`}
            className="button secondary"
          >
            <Eye size={14} />
            プレビュー
          </Link>
        )}
        {report.state === "published" && (
          <>
            <RevisionForm id={report.id} />
            <Link
              className="button primary"
              href={`/reports/${report.period}?version=${report.version}`}
            >
              公開レポートを見る
              <ArrowRight size={14} />
            </Link>
          </>
        )}
      </div>
      {editing.dirty && (
        <p className="form-error" role="status">
          未保存の入力があります。
          {editing.sections.editor?.dirty &&
            "レポート本文の「変更を保存」を押してください。"}
          {editing.sections.notes?.dirty &&
            "今月の出来事の「入力を保存」を押してください。"}
          保存してから、プレビュー・レビュー・承認・公開へ進んでください。
        </p>
      )}
      {!editing.dirty && editing.busy && (
        <p className="workflow-info" role="status">
          保存・生成・添付の処理が完了するまでお待ちください。
        </p>
      )}
      <p className="workflow-info">
        {report.state === "published"
          ? "公開済みSnapshotは変更できません。修正は新しいVersionとして作成します。"
          : "AI生成はDraftまで。人によるレビュー → 承認 → 公開を個別に実行します。編集・再生成・再Importをすると承認は解除されます。"}
        <br />
        Source: {report.content.financial.isMock ? "Mock" : "Management"} ·
        Analysis:{" "}
        {report.analysis === "generated-mock"
          ? "Mock AI generated / レビュー待ち"
          : report.analysis === "reviewed-mock"
            ? "Human reviewed · Mock"
            : report.analysis === "generated-ai"
              ? report.state === "published"
                ? "AI assisted · Human approved"
                : "AI generated / レビュー待ち"
              : report.analysis === "reviewed"
                ? "Management reviewed"
                : report.analysis === "human-authored"
                  ? "Management authored"
                  : "未生成"}{" "}
        · Revision {report.revision}
      </p>
      {state.error && (
        <p className="form-error create-form-state" role="alert">
          {state.error}
        </p>
      )}
      {state.success && (
        <p className="form-success create-form-state" role="status">
          {state.success}
        </p>
      )}
    </div>
  );
}
