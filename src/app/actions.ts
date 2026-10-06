"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import {
  getActor,
  requireAdmin,
  SESSION_COOKIE,
  setSession,
} from "@/lib/server/auth";
import {
  requireMockEnvironment,
  isMockEnvironment,
  productionConfigured,
  productionConfiguration,
} from "@/lib/server/environment";
import { createSupabaseClient } from "@/lib/server/supabase";
import {
  createReport,
  mutateReport,
  reviseReport,
} from "@/lib/server/repository";
import type { WorkflowOperation } from "@/lib/domain/types";

export type ActionResult = { error?: string; success?: string };
function errorMessage(error: unknown) {
  if (error instanceof z.ZodError)
    return "入力内容を確認してください。必須項目・文字数・期間・分類を確認できます。";
  return error instanceof Error
    ? error.message
    : "処理に失敗しました。もう一度お試しください。";
}
export async function loginAction(
  _state: ActionResult,
  form: FormData,
): Promise<ActionResult> {
  try {
    const email = String(form.get("email") || "")
      .trim()
      .toLowerCase();
    const password = String(form.get("password") || "");
    if (!isMockEnvironment()) {
      const client = await createSupabaseClient();
      const { error } = await client.auth.signInWithPassword({
        email,
        password,
      });
      if (error)
        return { error: "メールアドレスまたはパスワードが正しくありません。" };
      await client.rpc("ir_accept_invitation", {
        p_company: productionConfiguration().companyId,
      });
      if (!(await getActor())) {
        await client.auth.signOut();
        return {
          error:
            "アクセス権がありません。管理者にメールアドレスの登録をご依頼ください。",
        };
      }
    } else {
      if (
        password !== "prorium-demo" ||
        !["investor@prorium.example", "admin@prorium.example"].includes(email)
      )
        return { error: "メールアドレスまたはパスワードが正しくありません。" };
      const role = email === "admin@prorium.example" ? "admin" : "investor";
      await setSession({
        id: role === "admin" ? "demo-admin" : "demo-investor",
        role,
        companyId: "prorium",
      });
    }
  } catch (error) {
    return { error: errorMessage(error) };
  }
  const actor = await getActor();
  redirect(
    actor?.role === "admin"
      ? actor.needsMfa
        ? "/account/security"
        : "/admin"
      : "/dashboard",
  );
}
export async function enterDemoAction(form: FormData) {
  requireMockEnvironment();
  const role = form.get("role") === "admin" ? "admin" : "investor";
  await setSession({
    id: role === "admin" ? "demo-admin" : "demo-investor",
    role,
    companyId: "prorium",
  });
  redirect(role === "admin" ? "/admin" : "/dashboard");
}
export async function logoutAction() {
  if (productionConfigured())
    await (await createSupabaseClient()).auth.signOut();
  (await cookies()).delete(SESSION_COOKIE);
  redirect("/login");
}
export async function createReportAction(
  _state: ActionResult,
  form: FormData,
): Promise<ActionResult> {
  const actor = await requireAdmin();
  let id: string;
  try {
    id = (
      await createReport(
        String(form.get("period")),
        actor,
        form.get("summaryOnly") === "on",
      )
    ).id;
  } catch (error) {
    return { error: errorMessage(error) };
  }
  revalidatePath("/admin/reports");
  redirect(`/admin/reports/${id}`);
}
export async function reviseReportAction(
  _state: ActionResult,
  form: FormData,
): Promise<ActionResult> {
  const actor = await requireAdmin();
  let id: string;
  try {
    id = (
      await reviseReport(
        String(form.get("id")),
        actor,
        form.get("kind") === "major" ? "major" : "minor",
      )
    ).id;
  } catch (error) {
    return { error: errorMessage(error) };
  }
  revalidatePath("/admin/reports");
  redirect(`/admin/reports/${id}`);
}
export async function reportOperationAction(
  _state: ActionResult,
  form: FormData,
): Promise<ActionResult> {
  const actor = await requireAdmin();
  const id = String(form.get("id"));
  try {
    const operation = z
      .enum(["edit", "generate", "import", "review", "approve", "publish"])
      .parse(form.get("operation")) as WorkflowOperation;
    const revision = z.coerce
      .number()
      .int()
      .positive()
      .parse(form.get("revision"));
    const raw = form.get("payload");
    if (raw && String(raw).length > 100_000)
      return { error: "入力内容が大きすぎます。" };
    const payload = raw ? JSON.parse(String(raw)) : undefined;
    await mutateReport(id, actor, revision, operation, payload);
    revalidatePath(`/admin/reports/${id}`);
    revalidatePath("/admin");
    revalidatePath("/admin/reports");
    revalidatePath("/reports");
    revalidatePath("/dashboard");
    revalidatePath("/admin/import");
    return {
      success:
        operation === "publish"
          ? "公開しました。株主画面で確認できます。"
          : operation === "generate"
            ? "Mock AI Draftを生成しました。人による確認と承認が必要です。"
            : operation === "import"
              ? "Mock Importを検証し、新しいSnapshotを保存しました。"
              : "保存しました。",
    };
  } catch (error) {
    return { error: errorMessage(error) };
  }
}
