"use client";
import { useState } from "react";
import { Download, LoaderCircle } from "lucide-react";

export function PdfButton({
  period,
  version,
}: {
  period: string;
  version: string;
}) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  async function download() {
    setPending(true);
    setError("");
    try {
      const response = await fetch(
        `/api/reports/${period}/pdf?version=${encodeURIComponent(version)}`,
      );
      if (!response.ok)
        throw new Error("PDFを生成できませんでした。もう一度お試しください。");
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Prorium-${period}-${version}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setError(e instanceof Error ? e.message : "PDF出力に失敗しました。");
    } finally {
      setPending(false);
    }
  }
  return (
    <div className="pdf-control">
      <button className="button primary" onClick={download} disabled={pending}>
        {pending ? (
          <LoaderCircle size={16} className="spinner" />
        ) : (
          <Download size={16} />
        )}
        {pending ? "PDFを生成中…" : "PDFをダウンロード"}
      </button>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
