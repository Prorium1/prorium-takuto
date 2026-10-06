"use client";
import { useActionState, useState } from "react";
import { CheckCircle2, Upload } from "lucide-react";
import { reportOperationAction } from "@/app/actions";
import type { ReportVersion } from "@/lib/domain/types";
import { periodLabel } from "@/lib/domain/finance";

export function ImportForm({ reports }: { reports: ReportVersion[] }) {
  const [id, setId] = useState(reports[0]?.id || "");
  const report = reports.find((r) => r.id === id);
  const [state, action, pending] = useActionState(reportOperationAction, {});
  return (
    <>
      <form action={action} className="import-target-form">
        <input type="hidden" name="id" value={id} />
        <input type="hidden" name="revision" value={report?.revision ?? 1} />
        <input type="hidden" name="operation" value="import" />
        <label>
          Import先の未公開レポート
          <select value={id} onChange={(e) => setId(e.target.value)} required>
            {reports.length === 0 && (
              <option value="">未公開レポートを作成してください</option>
            )}
            {reports.map((r) => (
              <option key={r.id} value={r.id}>
                {periodLabel(r.period)} · {r.version} · {r.state}
              </option>
            ))}
          </select>
        </label>
        <button disabled={pending || !report} className="button primary">
          <Upload size={15} />
          {pending ? "検証・保存中…" : "MockデータをImport"}
        </button>
      </form>
      <div className="import-validation">
        {["期間・通貨の検証", "貸借一致・数値の検証", "変化要因の整合性"].map(
          (v) => (
            <span key={v}>
              <CheckCircle2 size={14} />
              {v}
            </span>
          ),
        )}
      </div>
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
      <p className="admin-info">
        この画面は合成データのImportをシミュレーションします。freeeへの接続・OAuth認証・実データのアップロードは未接続です。公開済みレポートは対象にできません。
      </p>
    </>
  );
}
