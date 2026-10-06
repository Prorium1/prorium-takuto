import { Shell } from "@/components/shell";
import { DocumentList } from "@/components/document-list";
import { requireActor } from "@/lib/server/auth";
import { listFinancialDocuments } from "@/lib/server/documents";
import { DOCUMENT_CATEGORIES } from "@/lib/domain/documents";
export const dynamic = "force-dynamic";
export default async function DocumentsPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string; category?: string }>;
}) {
  const actor = await requireActor();
  const filter = await searchParams;
  const documents = await listFinancialDocuments(actor);
  const periods = [...new Set(documents.map((d) => d.period))].sort().reverse();
  const selected = documents.filter(
    (d) =>
      (!filter.period || d.period === filter.period) &&
      (!filter.category || d.category === filter.category),
  );
  return (
    <Shell role={actor.role}>
      <div className="page-heading">
        <span className="eyebrow">FINANCIAL DOCUMENTS</span>
        <h1>財務資料ライブラリ</h1>
        <p>P/L・B/S・残高試算表など、月ごとの確認済み資料をお届けします。</p>
      </div>
      <form className="document-filters">
        <label>
          対象月
          <select name="period" defaultValue={filter.period || ""}>
            <option value="">すべての月</option>
            {periods.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </label>
        <label>
          書類の種類
          <select name="category" defaultValue={filter.category || ""}>
            <option value="">すべての書類</option>
            {Object.entries(DOCUMENT_CATEGORIES).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </label>
        <button className="button secondary">絞り込む</button>
      </form>
      {selected.length ? (
        <DocumentList documents={selected} />
      ) : (
        <div className="empty-state">
          <h2>共有済みの財務資料はまだありません。</h2>
          <p>
            管理者が月次レポートと一緒に公開すると、ここからダウンロードできます。
          </p>
        </div>
      )}
      <p className="archive-note">
        資料は公開時点のファイルです。対象月・単月／累計・改訂版を確認してご利用ください。
      </p>
    </Shell>
  );
}
