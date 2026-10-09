"use server";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@supabase/supabase-js";
import { createSupabaseClient } from "@/lib/server/supabase";
import { productionConfiguration } from "@/lib/server/environment";
import { getActor } from "@/lib/server/auth";
import { parseEmailConfirmationLink } from "@/lib/domain/email-confirmation-link";
import { loginEmailError } from "@/lib/domain/login-error";
import type { ActionResult } from "./actions";
export async function sendLoginLinkAction(
  _state: ActionResult,
  form: FormData,
): Promise<ActionResult> {
  try {
    const email = z.email().max(254).parse(form.get("email"));
    const config = productionConfiguration();
    // Email is opened by a browser that may not hold the originating PKCE cookie.
    // The callback transfers the implicit session to an HttpOnly server cookie.
    const client = createClient(config.url, config.key, {
      auth: {
        flowType: "implicit",
        autoRefreshToken: false,
        persistSession: false,
        detectSessionInUrl: false,
      },
    });
    const { error } = await client.auth.signInWithOtp({
      email,
      options: {
        shouldCreateUser: true,
        emailRedirectTo: `${config.origin}/auth/callback`,
      },
    });
    if (error) return { error: loginEmailError(error) };
    return {
      success:
        "メール内の最新のリンクを一度開いてください。認証後に管理者の本人確認へ進みます。",
    };
  } catch {
    return { error: "メールアドレスと本番接続の設定を確認してください。" };
  }
}
export async function completeEmailLoginAction(
  accessToken: string,
  refreshToken: string,
): Promise<ActionResult> {
  let destination: string;
  try {
    const config = productionConfiguration();
    // Token length is not an authorization check. Supabase verifies both tokens.
    const access = z.string().min(1).max(8000).parse(accessToken);
    const refresh = z.string().min(1).max(2000).parse(refreshToken);
    const client = await createSupabaseClient();
    const { error } = await client.auth.setSession({
      access_token: access,
      refresh_token: refresh,
    });
    if (error)
      return {
        error:
          "認証リンクを確認できませんでした。新しいメールでお試しください。",
      };
    const { data: identity, error: identityError } =
      await client.auth.getUser();
    if (identityError || !identity.user)
      return { error: "本人確認を完了できませんでした。" };
    const { error: invitationError } = await client.rpc(
      "ir_accept_invitation",
      {
        p_company: config.companyId,
      },
    );
    if (invitationError) throw invitationError;
    const { data: actor, error: actorError } = await client.rpc(
      "ir_current_actor",
      {
        p_company: config.companyId,
      },
    );
    if (actorError || !actor || actor.id !== identity.user.id) {
      await client.auth.signOut();
      return { error: "このメールアドレスにはIRサイトの招待がありません。" };
    }
    destination =
      actor.role === "admin"
        ? actor.needsMfa
          ? "/account/security"
          : "/admin"
        : "/dashboard";
  } catch {
    return {
      error: "ログインを完了できませんでした。新しいメールでお試しください。",
    };
  }
  redirect(destination);
}
export async function confirmEmailLinkAction(
  _state: ActionResult,
  form: FormData,
): Promise<ActionResult> {
  let destination: string;
  try {
    const config = productionConfiguration();
    const raw = z.string().max(5000).parse(form.get("confirmationLink"));
    const token = parseEmailConfirmationLink(raw, config.url);
    const client = await createSupabaseClient();
    const { data: verified, error } = await client.auth.verifyOtp(token);
    if (error || !verified.session || !verified.user)
      return {
        error:
          "リンクを確認できませんでした。新しいメールを発行し、リンクを開かずにコピーしてください。",
      };
    const { error: invitationError } = await client.rpc(
      "ir_accept_invitation",
      {
        p_company: config.companyId,
      },
    );
    if (invitationError) throw invitationError;
    const { data: actor, error: actorError } = await client.rpc(
      "ir_current_actor",
      {
        p_company: config.companyId,
      },
    );
    if (actorError || !actor || actor.id !== verified.user.id) {
      await client.auth.signOut();
      return { error: "このメールアドレスにはIRサイトの招待がありません。" };
    }
    destination =
      actor.role === "admin"
        ? actor.needsMfa
          ? "/account/security"
          : "/admin"
        : "/dashboard";
  } catch {
    return {
      error: "Supabaseから届いた新しい認証リンクを貼り付けてください。",
    };
  }
  redirect(destination);
}
async function adminForMfa() {
  const actor = await getActor();
  if (!actor || actor.role !== "admin")
    throw new Error("管理者の認証が必要です。");
  return createSupabaseClient();
}
export type MfaResult = ActionResult & { factorId?: string; qrCode?: string };
export async function enrollMfaAction(_state: MfaResult): Promise<MfaResult> {
  void _state;
  try {
    const client = await adminForMfa();
    const { data: factors, error: factorError } =
      await client.auth.mfa.listFactors();
    if (factorError) throw factorError;
    if (factors.totp.some((f) => f.status === "verified"))
      return { error: "登録済みの認証アプリで6桁のコードを入力してください。" };
    for (const f of factors.all.filter(
      (f) => f.factor_type === "totp" && f.status === "unverified",
    ))
      await client.auth.mfa.unenroll({ factorId: f.id });
    const { data, error } = await client.auth.mfa.enroll({
      factorType: "totp",
      issuer: "Prorium IR",
      friendlyName: "Prorium management",
    });
    if (error) throw error;
    return {
      factorId: data.id,
      qrCode: data.totp.qr_code,
      success:
        "認証アプリでQRコードを読み取り、6桁のコードを入力してください。",
    };
  } catch {
    return {
      error: "MFAを設定できませんでした。再ログインしてお試しください。",
    };
  }
}
export async function verifyMfaAction(
  _state: ActionResult,
  form: FormData,
): Promise<ActionResult> {
  try {
    const client = await adminForMfa();
    const code = z
      .string()
      .regex(/^\d{6}$/)
      .parse(form.get("code"));
    const factorId = z.uuid().parse(form.get("factorId"));
    const { data } = await client.auth.mfa.listFactors();
    if (!data?.all.some((f) => f.id === factorId && f.factor_type === "totp"))
      throw new Error("Unknown factor");
    const { error } = await client.auth.mfa.challengeAndVerify({
      factorId,
      code,
    });
    if (error)
      return {
        error:
          "コードを確認してください。時間が経過した場合は新しいコードを入力してください。",
      };
  } catch {
    return { error: "認証アプリの6桁のコードを入力してください。" };
  }
  redirect("/admin");
}
