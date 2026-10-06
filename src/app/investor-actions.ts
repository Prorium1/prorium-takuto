"use server";
import { requireAdmin } from "@/lib/server/auth";
import {
  productionClient,
  databaseError,
} from "@/lib/server/production-repository";
import { isMockEnvironment } from "@/lib/server/environment";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { ActionResult } from "./actions";
export async function investorAccessAction(
  _state: ActionResult,
  form: FormData,
): Promise<ActionResult> {
  const actor = await requireAdmin();
  try {
    if (isMockEnvironment())
      throw new Error("Mock環境で本番の投資家は登録できません。");
    const email = z.email().max(254).parse(form.get("email"));
    const active =
      z.enum(["true", "false"]).parse(form.get("active")) === "true";
    const client = await productionClient(actor, true);
    const { error } = await client.rpc("ir_set_invitation", {
      p_company: actor.companyId,
      p_email: email,
      p_active: active,
    });
    databaseError(error);
    revalidatePath("/admin/investors");
    return {
      success: active
        ? "アクセス権を登録しました。"
        : "アクセスを停止しました。",
    };
  } catch {
    return {
      error:
        "登録できませんでした。メールアドレスと管理者権限を確認してください。",
    };
  }
}
