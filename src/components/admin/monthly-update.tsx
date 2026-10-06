"use client";
import { useActionState, useState } from "react";
import { Sparkles, Save, FileText } from "lucide-react";
import { monthlyUpdateAction } from "@/app/monthly-actions";
import type { ReportVersion } from "@/lib/domain/types";
import { useReportSection } from "./editing-guard";
import { normalizeMonthlyNotes } from "@/lib/domain/text";
export function MonthlyUpdateForm({
  report,
  notes,
  aiEnabled,
}: {
  report: ReportVersion;
  notes: string;
  aiEnabled: boolean;
}) {
  const [state, action, pending] = useActionState(monthlyUpdateAction, {});
  const [text, setText] = useState(notes);
  const [submittedMode, setSubmittedMode] = useState("save");
  const editing = useReportSection(
    "notes",
    normalizeMonthlyNotes(text) !== normalizeMonthlyNotes(notes),
    pending,
  );
  const busy = pending || editing.otherBusy("notes");
  return (
    <section className="admin-panel monthly-input">
      <div className="panel-heading">
        <h2>今月の出来事を教えてください</h2>
        <span>MONTHLY UPDATE</span>
      </div>
      <p className="admin-info">
        箇条書きや普段の言葉で構いません。進捗、変化の理由、課題、来月の予定を入力してください。スマートフォンの音声入力も使えます。
      </p>
      <form action={action} aria-busy={pending}>
        <input type="hidden" name="id" value={report.id} />
        <input type="hidden" name="revision" value={report.revision} />
        <div className="form-field">
          <label htmlFor="monthly-notes">今月あったこと</label>
          <textarea
            id="monthly-notes"
            name="notes"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="・今月進んだこと\n・数字が変わった理由\n・気になっている課題\n・来月取り組むこと"
            minLength={10}
            maxLength={12000}
            rows={8}
            readOnly={busy}
            required
          />
        </div>
        <div className="workflow-controls">
          <button
            className="button secondary"
            name="mode"
            value="save"
            disabled={busy}
            onClick={() => setSubmittedMode("save")}
          >
            <Save size={14} />
            {pending && submittedMode === "save" ? "保存中…" : "入力を保存"}
          </button>
          {aiEnabled && (
            <button
              className="button primary"
              name="mode"
              value="generate"
              disabled={busy || editing.editorDirty}
              onClick={() => setSubmittedMode("generate")}
            >
              <Sparkles size={14} />
              {pending && submittedMode === "generate"
                ? "AIで作成中…"
                : "AIで今月のサマリーを作成"}
            </button>
          )}
          <button
            className={`button ${aiEnabled ? "secondary" : "primary"}`}
            name="mode"
            value="structure"
            disabled={busy || editing.editorDirty}
            onClick={() => setSubmittedMode("structure")}
          >
            <FileText size={14} />
            {pending && submittedMode === "structure"
              ? "整理中…"
              : "文章を整理して下書き"}
          </button>
        </div>
        <p className="workflow-info">
          {editing.editorDirty &&
            "本文に未保存の編集があります。「変更を保存」してから下書きを作成してください。"}
          入力原文の保存場所は管理者専用です。下書きには原文が引用されるため、本文・要点・見通しから非公開情報や誤りを削除し、プレビューで確認してください。承認・公開は人が行います。
          {!aiEnabled && "現在は入力した文章の整理モードです。"}
          {aiEnabled &&
            "AI生成の前に原文を保存します。AIが使えない場合も文章整理で下書きを作成できます。"}
        </p>
        {state.error && (
          <p role="alert" className="form-error">
            {state.error}
          </p>
        )}
        {state.success && (
          <p role="status" className="form-success">
            {state.success}
          </p>
        )}
      </form>
    </section>
  );
}
