"use client";
import { useState } from "react";
import { Download, LoaderCircle } from "lucide-react";

export function PdfButton({
  period,
  version,
  browserPrint = false,
  endpoint,
  filename,
  disabled = false,
}: {
  period: string;
  version: string;
  browserPrint?: boolean;
  endpoint?: string;
  filename?: string;
  disabled?: boolean;
}) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  async function download() {
    if (browserPrint) {
      window.print();
      return;
    }
    setPending(true);
    setError("");
    try {
      const response = await fetch(
        endpoint ||
          `/api/reports/${period}/pdf?version=${encodeURIComponent(version)}`,
      );
      if (!response.ok)
        throw new Error("PDFを生成できませんでした。もう一度お試しください。");
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename || `Prorium-${period}-${version}.pdf`;
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
      <button
        className="button secondary"
        onClick={download}
        disabled={pending || disabled}
      >
        {pending ? (
          <LoaderCircle size={16} className="spinner" />
        ) : (
          <Download size={16} />
        )}
        {pending
          ? "資料を準備しています…"
          : browserPrint
            ? "資料を保存・印刷"
            : "資料を保存（PDF）"}
      </button>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
