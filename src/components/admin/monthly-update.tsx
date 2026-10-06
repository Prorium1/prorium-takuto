"use client";
import { useActionState, useState } from "react";
import { Sparkles, Save } from "lucide-react";
import { monthlyUpdateAction } from "@/app/monthly-actions";
import type { ReportVersion } from "@/lib/domain/types";
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
  return (
    <section className="admin-panel monthly-input">
      <div className="panel-heading">
        <h2>今月の出来事を教えてください</h2>
        <span>MONTHLY UPDATE</span>
      </div>
      <p className="admin-info">
        箇条書きや普段の言葉で構いません。進捗、変化の理由、課題、来月の予定を入力してください。スマートフォンの音声入力も使えます。
      </p>
      <form action={action}>
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
            required
          />
        </div>
        <div className="workflow-controls">
          <button
            className="button secondary"
            name="mode"
            value="save"
            disabled={pending}
          >
            <Save size={14} />
            入力を保存
          </button>
          <button
            className="button primary"
            name="mode"
            value={aiEnabled ? "generate" : "structure"}
            disabled={pending}
          >
            <Sparkles size={14} />
            {pending
              ? "作成中…"
              : aiEnabled
                ? "AIで今月のサマリーを作成"
                : "文章からサマリーの下書きを作成"}
          </button>
        </div>
        <p className="workflow-info">
          入力原文の保存場所は管理者専用です。下書きには原文が引用されるため、本文・要点・見通しから非公開情報や誤りを削除し、プレビューで確認してください。承認・公開は人が行います。
          {!aiEnabled && "現在は入力した文章の整理モードです。"}
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
