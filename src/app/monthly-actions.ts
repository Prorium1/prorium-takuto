"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/lib/server/auth";
import { getAdminReport } from "@/lib/server/repository";
import { isMockEnvironment } from "@/lib/server/environment";
import {
  monthlyNotesSchema,
  structureMonthlyNotes,
  applyFinancialEntry,
} from "@/lib/domain/monthly";
import { prepareMonthlySummary } from "@/lib/server/monthly";
import type { ActionResult } from "./actions";
import { saveContent } from "@/lib/server/updates";
import { humanEditAnalysis } from "@/lib/domain/provenance";
export async function monthlyUpdateAction(
  _state: ActionResult,
  form: FormData,
): Promise<ActionResult> {
  const actor = await requireAdmin();
  const id = String(form.get("id"));
  try {
    const revision = z.coerce
      .number()
      .int()
      .positive()
      .parse(form.get("revision"));
    const notes = monthlyNotesSchema.parse(form.get("notes"));
    const report = await getAdminReport(id, actor);
    if (!report || report.state === "published")
      throw new Error("編集可能なレポートを選択してください。");
    const mode = z
      .enum(["save", "structure", "generate"])
      .parse(form.get("mode"));
    const content = structuredClone(report.content);
    let method: "editorial" | "openai" = "editorial";
    if (mode !== "save") {
      const result =
        mode === "generate"
          ? await prepareMonthlySummary(report.period, notes)
          : {
              summary: structureMonthlyNotes(report.period, notes),
              method: "editorial" as const,
            };
      content.summary = result.summary;
      method = result.method;
    }
    await saveContent(
      id,
      actor,
      revision,
      content,
      mode === "save"
        ? report.analysis
        : method === "openai"
          ? "generated-ai"
          : "human-authored",
      notes,
    );
    revalidatePath(`/admin/reports/${id}`);
    revalidatePath("/admin");
    return {
      success:
        mode === "save"
          ? "今月の出来事を管理者専用に保存しました。サマリーの公開内容はプレビューで確認してください。"
          : `${method === "openai" ? "AIで" : "入力した文章から"}サマリーの下書きを作成しました。内容を確認してから承認・公開してください。`,
    };
  } catch (error) {
    return {
      error:
        error instanceof z.ZodError
          ? "今月の出来事を10〜12,000文字で入力してください。"
          : error instanceof Error
            ? error.message
            : "保存に失敗しました。",
    };
  }
}
export async function financialEntryAction(
  _state: ActionResult,
  form: FormData,
): Promise<ActionResult> {
  const actor = await requireAdmin();
  const id = String(form.get("id"));
  try {
    if (isMockEnvironment())
      throw new Error(
        "開発環境では実際の財務数値を登録できません。サンプルImportをご利用ください。",
      );
    const revision = z.coerce
      .number()
      .int()
      .positive()
      .parse(form.get("revision"));
    const report = await getAdminReport(id, actor);
    if (!report) throw new Error("レポートがありません。");
    const values = Object.fromEntries(
      [...form.entries()]
        .filter(([k]) => !["id", "revision"].includes(k))
        .map(([k, v]) => [k, k.endsWith("Reason") ? String(v) : Number(v)]),
    );
    await saveContent(
      id,
      actor,
      revision,
      applyFinancialEntry(report.content, values),
      humanEditAnalysis(report.analysis),
    );
    revalidatePath(`/admin/reports/${id}`);
    return {
      success: "財務Snapshotを保存しました。確認・承認後に株主へ公開できます。",
    };
  } catch (error) {
    return {
      error:
        error instanceof z.ZodError
          ? "円単位の整数・貸借の一致・増減理由を確認してください。"
          : error instanceof Error
            ? error.message
            : "保存できませんでした。",
    };
  }
}
