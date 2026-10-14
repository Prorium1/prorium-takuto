import "server-only";
import { ownershipSchema } from "../domain/ownership";
import { humanEditAnalysis } from "../domain/provenance";
import type { Actor } from "../domain/types";
import { getAdminReport } from "./repository";
import { saveContent } from "./updates";
export async function saveOwnership(
  id: string,
  actor: Actor,
  revision: number,
  input: unknown,
) {
  if (actor.role !== "admin") throw new Error("管理者権限が必要です。");
  if (!Number.isSafeInteger(revision) || revision < 1)
    throw new Error("更新番号を確認してください。");
  const snapshot = ownershipSchema.parse(input);
  const report = await getAdminReport(id, actor);
  if (!report || report.state !== "draft")
    throw new Error(
      "株主構成は未公開の下書きで編集してください。公開済みの場合は改訂版を作成します。",
    );
  if (report.revision !== revision)
    throw new Error(
      "別の更新が反映されています。入力を控えて、画面を再読み込みしてください。",
    );
  return saveContent(
    id,
    actor,
    revision,
    { ...report.content, ownership: snapshot },
    humanEditAnalysis(report.analysis),
  );
}
