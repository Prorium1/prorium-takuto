"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireAdmin } from "@/lib/server/auth";
import { isMockEnvironment } from "@/lib/server/environment";
import {
  getAdminReport,
  saveContent,
} from "@/lib/server/production-repository";
import { preparedEvent } from "@/lib/server/prepared-event";
import { humanEditAnalysis } from "@/lib/domain/provenance";
import type { ActionResult } from "./actions";

export async function addPreparedEventAction(
  _state: ActionResult,
  form: FormData,
): Promise<ActionResult> {
  const actor = await requireAdmin();
  let id: string;
  try {
    if (isMockEnvironment())
      throw new Error(
        "実際の大会情報の追加は本番の管理画面から行ってください。",
      );
    id = z.uuid().parse(form.get("id"));
    const revision = z.coerce
      .number()
      .int()
      .nonnegative()
      .parse(form.get("revision"));
    const report = await getAdminReport(id, actor);
    if (
      !report ||
      report.companyId !== actor.companyId ||
      report.period !== "2026-08"
    )
      throw new Error("対象の下書きが見つかりません。");
    if (report.state === "published")
      throw new Error(
        "公開済みのレポートには追加できません。改訂版を作成してください。",
      );
    if (report.revision !== revision)
      throw new Error("別の変更が反映されています。再読み込みしてください。");
    if (report.content.eventSpotlight)
      throw new Error(
        "大会情報が既に入力されています。編集画面から内容を確認してください。",
      );
    await saveContent(
      id,
      actor,
      revision,
      { ...report.content, eventSpotlight: preparedEvent },
      humanEditAnalysis(report.analysis),
    );
  } catch (error) {
    return {
      error:
        error instanceof z.ZodError
          ? "追加対象を確認して、再読み込みしてください。"
          : error instanceof Error
            ? error.message
            : "大会情報を追加できませんでした。",
    };
  }
  revalidatePath(`/admin/reports/${id}`);
  revalidatePath("/admin");
  revalidatePath("/admin/reports");
  redirect(`/admin/reports/${id}?preview=1#event`);
}
