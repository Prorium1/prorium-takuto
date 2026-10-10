"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/lib/server/auth";
import { isMockEnvironment } from "@/lib/server/environment";
import { productionClient, databaseError } from "@/lib/server/production-repository";
import { buildFreeeDraftContent, buildPendingFreeeDraftContent } from "@/lib/domain/freee-draft";
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

export async function promoteFreeePendingAction(_state: ActionResult, form: FormData): Promise<ActionResult & { reportId?: string }> {
  const actor = await requireAdmin();
  try {
    if (isMockEnvironment()) throw new Error("Mock環境で実データを取り込むことはできません。");
    const stageId = z.uuid().parse(form.get("stageId"));
    const client = await productionClient(actor, true);
    const { data: stages, error: listError } = await client.rpc("ir_list_freee_staged", { p_company: actor.companyId });
    databaseError(listError);
    const stage = (stages || []).find((row: { id: string }) => row.id === stageId);
    if (!stage) throw new Error("取込候補が見つかりません。画面を再読み込みしてください。");
    const content = buildPendingFreeeDraftContent(stage, actor.companyId);
    const { data, error } = await client.rpc("ir_promote_freee_stage_pending", {
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
    return { success: "会計確認済みの数値で非公開下書きを作成しました。固定費と増減理由を入力するまでレビュー・公開はできません。", reportId: result.id };
  } catch (error) {
    return { error: error instanceof z.ZodError ? "取込候補と確認項目を確認してください。" : error instanceof Error ? error.message : "下書きを作成できませんでした。" };
  }
}

export async function completeFreeeContextAction(_state: ActionResult, form: FormData): Promise<ActionResult> {
  const actor = await requireAdmin();
  try {
    if (isMockEnvironment()) throw new Error("Mock環境で実データを保存できません。");
    const id = z.uuid().parse(form.get("id"));
    const revision = z.coerce.number().int().positive().parse(form.get("revision"));
    const fixedInput = form.get("monthlyFixedCosts");
    if (typeof fixedInput !== "string" || !/^\d+$/.test(fixedInput.trim())) throw new Error("確認済み月次固定費を円単位で入力してください。");
    const fixed = z.number().safe().int().nonnegative().parse(Number(fixedInput));
    const revenueReason = z.string().trim().min(10).max(900).parse(form.get("revenueReason"));
    const profitReason = z.string().trim().min(10).max(900).parse(form.get("profitReason"));
    const client = await productionClient(actor, true);
    const { error } = await client.rpc("ir_complete_freee_context", {
      p_id: id,
      p_revision: revision,
      p_fixed_costs: fixed,
      p_revenue_reason: revenueReason,
      p_profit_reason: profitReason,
    });
    databaseError(error);
    revalidatePath(`/admin/reports/${id}`);
    revalidatePath("/admin/reports");
    return { success: "固定費と増減理由を保存しました。サマリーとCEOコメントを確認してからレビューへ進めます。" };
  } catch (error) {
    return { error: error instanceof z.ZodError ? "固定費と10文字以上の増減理由を入力してください。" : error instanceof Error ? error.message : "保存できませんでした。" };
  }
}
