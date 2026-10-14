import "server-only";
import type { Actor } from "../domain/types";
import {
  ownershipImportSchema,
  type OwnershipImport,
} from "../domain/ownership-import";
import { isMockEnvironment } from "./environment";

export async function getOwnershipImport(
  actor: Actor,
): Promise<OwnershipImport | null> {
  if (actor.role !== "admin") throw new Error("管理者権限が必要です。");
  if (isMockEnvironment()) {
    const { augustReport } = await import("../mock/seed");
    if (actor.companyId !== augustReport.companyId) return null;
    return ownershipImportSchema.parse({
      snapshot: {
        ...augustReport.content.ownership,
        sourceLabel: "smartround形式の架空サンプル（未接続）",
      },
      retrievedAt: "2026-09-05T01:30:00Z",
    });
  }
  const { productionClient, databaseError } =
    await import("./production-repository");
  const client = await productionClient(actor, true);
  const { data, error } = await client.rpc("ir_get_ownership_import", {
    p_company: actor.companyId,
  });
  databaseError(error);
  if (data === null) return null;
  const parsed = ownershipImportSchema.safeParse(data);
  if (!parsed.success)
    throw new Error("取り込んだ株主名簿の形式を確認できませんでした。");
  return parsed.data;
}
