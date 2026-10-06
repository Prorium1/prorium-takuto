import { Download, FileText } from "lucide-react";
import { DOCUMENT_BASES, DOCUMENT_CATEGORIES } from "@/lib/domain/documents";
import type { FinancialDocument } from "@/lib/domain/types";
export function DocumentList({
  documents,
  print = false,
}: {
  documents: FinancialDocument[];
  print?: boolean;
}) {
  return (
    <div className="document-grid">
      {documents.map((d) => (
        <article className="document-card" key={d.id}>
          <div className="document-card-top">
            <FileText size={22} />
            <span className="badge badge-neutral">
              {DOCUMENT_BASES[d.basis]}
            </span>
          </div>
          <span className="eyebrow">{DOCUMENT_CATEGORIES[d.category]}</span>
          <h3>{d.title}</h3>
          <p>{d.description}</p>
          <div className="document-details">
            <span>{d.period}</span>
            <span>PDF · {(d.bytes / 1024).toFixed(0)} KB</span>
          </div>
          {!print && (
            <a href={`/api/documents/${d.id}`} className="button secondary">
              <Download size={14} />
              PDFをダウンロード
            </a>
          )}
          {print && (
            <span className="footnote">
              資料は株主ポータルからダウンロードできます。
            </span>
          )}
        </article>
      ))}
    </div>
  );
}
