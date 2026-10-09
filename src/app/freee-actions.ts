"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/lib/server/auth";
import { isMockEnvironment } from "@/lib/server/environment";
import { productionClient, databaseError } from "@/lib/server/production-repository";
import { buildFreeeDraftContent } from "@/lib/domain/freee-draft";
import type { ActionResult } from "./actions";

export async function promoteFreeeStageAction(_state: ActionResult, form: FormData): Promise<ActionResult & { reportId?: string }> {
  const actor = await requireAdmin();
  try {
    if (isMockEnvironment()) throw new Error("Mock環境で実データを取り込むことはできません。");
    const stageId = z.uuid().parse(form.get("stageId"));
    const client = await productionClient(actor, true);
    const { data: stages, error: listError } = await client.rpc("ir_list_freee_staged", { p_company: actor.companyId });
    databaseError(listError);
    const stage = (stages || []).find((row: { id: string }) => row.id === stageId);
    if (!stage) throw new Error("取込候補が見つかりません。画面を再読み込みしてください。");
    const fixedCostsInput = form.get("monthlyFixedCosts");
    if (typeof fixedCostsInput !== "string" || fixedCostsInput.trim() === "") throw new Error("確認済み月次固定費を入力してください。");
    const content = buildFreeeDraftContent(stage, actor.companyId, {
      monthlyFixedCosts: Number(fixedCostsInput),
      revenueReason: String(form.get("revenueReason") || ""),
      profitReason: String(form.get("profitReason") || ""),
    });
    const { data, error } = await client.rpc("ir_promote_freee_stage", {
      p_stage: stageId,
      p_content: content,
      p_confirm_close: form.get("confirmClose") === "on",
      p_confirm_category: form.get("confirmCategory") === "on",
      p_confirm_cash: form.get("confirmCash") === "on",
    });
    databaseError(error);
    const result = Array.isArray(data) ? data[0] : data;
    revalidatePath("/admin/import");
    revalidatePath("/admin/reports");
    revalidatePath("/admin");
    return { success: "freeeの確認済みデータで非公開の月次下書きを作成しました。振り返り・CEOコメントを確認してから承認してください。", reportId: result.id };
  } catch (error) {
    return { error: error instanceof z.ZodError ? "固定費、増減理由、確認項目を入力してください。" : error instanceof Error ? error.message : "下書きを作成できませんでした。" };
  }
}
