import { notFound } from "next/navigation";
import Link from "next/link";
import { requireAdmin } from "@/lib/server/auth";
import { getFiscalPublication } from "@/lib/server/fiscal-publications";
import { isCloudMockPreview } from "@/lib/server/environment";
import { Shell } from "@/components/shell";
import { FiscalShareEditor } from "@/components/admin/fiscal-share-editor";
export const dynamic = "force-dynamic";
export default async function Page({
  params,
}: {
  params: Promise<{ year: string }>;
}) {
  const actor = await requireAdmin(),
    { year } = await params;
  if (!/^20\d{2}$/.test(year)) notFound();
  const report = await getFiscalPublication(
    actor,
    Number(year),
    undefined,
    true,
  );
  return (
    <Shell role={actor.role}>
      <Link className="simple-back" href="/admin">
        ← 経営者のホームに戻る
      </Link>
      <FiscalShareEditor
        key={`${report?.id}:${report?.revision}`}
        year={Number(year)}
        report={report}
        cloudPreview={isCloudMockPreview()}
      />
    </Shell>
  );
}
