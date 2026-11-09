"use server";
import { requireAdmin } from "@/lib/server/auth";
import {
  productionClient,
  databaseError,
} from "@/lib/server/production-repository";
import {
  isMockEnvironment,
  productionConfiguration,
} from "@/lib/server/environment";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { ActionResult } from "./actions";
import {
  investorCredentialError,
  type InvestorCredentials,
} from "@/lib/domain/investor-credentials";

export async function issueInvestorPasswordAction(
  form: FormData,
): Promise<{ credentials?: InvestorCredentials; error?: string }> {
  const actor = await requireAdmin();
  try {
    if (isMockEnvironment())
      return {
        error: "確認用データの画面では、本番のパスワードは発行できません。",
      };
    const email = z
      .email()
      .max(254)
      .parse(
        String(form.get("email") || "")
          .trim()
          .toLowerCase(),
      );
    const mode = z.enum(["create", "issue", "reset"]).parse(form.get("mode"));
    const acknowledged = form.get("acknowledged") === "yes";
    if (mode !== "create" && !acknowledged)
      return { error: investorCredentialError("invalid") };
    const client = await productionClient(actor, true);
    const { data, error } = await client.functions.invoke(
      "ir-investor-credentials",
      {
        body: { companyId: actor.companyId, email, mode, acknowledged },
      },
    );
    if (error) {
      // Only known error codes are returned; never expose an upstream request or Auth response.
      let code: unknown;
      if (error.context instanceof Response) {
        try {
          code = (await error.context.json()).error;
        } catch {
          /* generic error below */
        }
      }
      revalidatePath("/admin/investors");
      return { error: investorCredentialError(code) };
    }
    const result = z
      .object({
        email: z.literal(email),
        password: z
          .string()
          .regex(/^[A-HJ-NP-Za-km-z2-9]{5}(?:-[A-HJ-NP-Za-km-z2-9]{5}){3}$/),
      })
      .strict()
      .parse(data);
    revalidatePath("/admin/investors");
    return {
      credentials: {
        ...result,
        loginUrl: `${productionConfiguration().origin}/login`,
      },
    };
  } catch {
    return { error: investorCredentialError("unavailable") };
  }
}
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
