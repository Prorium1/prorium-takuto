"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { DOCUMENT_BASES, DOCUMENT_CATEGORIES } from "@/lib/domain/documents";
import type { ReportVersion } from "@/lib/domain/types";
import { detachDocumentAction } from "@/app/document-actions";
import { useReportSection } from "./editing-guard";
export function DocumentUploadForm({
  report,
  mock,
}: {
  report: ReportVersion;
  mock: boolean;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false),
    [error, setError] = useState(""),
    [success, setSuccess] = useState("");
  const editing = useReportSection("documents", false, pending);
  const blocked =
    pending || editing.editorDirty || editing.otherBusy("documents");
  async function upload(event: React.SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    if (blocked) return;
    const form = event.currentTarget;
    setPending(true);
    setError("");
    setSuccess("");
    try {
      const response = await fetch("/api/documents", {
        method: "POST",
        body: new FormData(form),
      });
      const result = await response.json();
      if (!response.ok)
        throw new Error(result.error || "アップロードに失敗しました。");
      setSuccess(result.success);
      form.reset();
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "アップロードに失敗しました。");
    } finally {
      setPending(false);
    }
  }
  return (
    <section className="admin-panel">
      <div className="panel-heading">
        <h2>株主に共有する財務資料</h2>
        <span>P/L · B/S · 試算表</span>
      </div>
      <p className="admin-info">
        月次レポートと一緒に公開します。単月と累計を明示し、公開後のファイル差し替えは改訂版で行います。
      </p>
      {mock && (
        <p className="workflow-info">
          開発環境では実データのPDFを登録できません。
          <a href="/api/documents/sample" download>
            MockサンプルPDFをダウンロード
          </a>
          してテストできます。
        </p>
      )}
      <form onSubmit={upload}>
        <input type="hidden" name="versionId" value={report.id} />
        <input type="hidden" name="revision" value={report.revision} />
        <input type="hidden" name="period" value={report.period} />
        <div className="financial-entry-grid">
          <div className="form-field">
            <label htmlFor="document-title">資料名</label>
            <input
              id="document-title"
              name="title"
              maxLength={120}
              placeholder="例：10月 損益計算書"
              required
            />
          </div>
          <div className="form-field">
            <label htmlFor="document-category">書類の種類</label>
            <select id="document-category" name="category">
              {Object.entries(DOCUMENT_CATEGORIES).map(([key, label]) => (
                <option value={key} key={key}>
                  {label}
                </option>
              ))}
            </select>
          </div>
          <div className="form-field">
            <label htmlFor="document-basis">対象範囲</label>
            <select id="document-basis" name="basis">
              {Object.entries(DOCUMENT_BASES).map(([key, label]) => (
                <option value={key} key={key}>
                  {label}
                </option>
              ))}
            </select>
          </div>
          <div className="form-field">
            <label htmlFor="document-file">PDFファイル（4 MB以下）</label>
            <input
              id="document-file"
              name="file"
              type="file"
              accept="application/pdf,.pdf"
              required
            />
          </div>
        </div>
        <div className="form-field">
          <label htmlFor="document-description">資料についての補足</label>
          <textarea
            id="document-description"
            name="description"
            maxLength={1000}
            rows={2}
          />
        </div>
        <button className="button primary" disabled={blocked}>
          {pending ? "アップロード中…" : "PDFを添付する"}
        </button>
      </form>
      {error && (
        <p role="alert" className="form-error">
          {error}
        </p>
      )}
      {success && (
        <p role="status" className="form-success">
          {success}
        </p>
      )}
      <div className="attached-files">
        {(report.content.documents || []).map((d) => (
          <div key={d.id}>
            <span>
              <a href={`/api/documents/${d.id}`}>{d.title}</a> ·{" "}
              {DOCUMENT_BASES[d.basis]}
            </span>
            <form action={detachDocumentAction}>
              <input type="hidden" name="id" value={report.id} />
              <input type="hidden" name="revision" value={report.revision} />
              <input type="hidden" name="documentId" value={d.id} />
              <button className="text-button" disabled={blocked}>
                添付から外す
              </button>
            </form>
          </div>
        ))}
      </div>
    </section>
  );
}
