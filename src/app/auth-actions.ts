"use server";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@supabase/supabase-js";
import { createSupabaseClient } from "@/lib/server/supabase";
import { productionConfiguration } from "@/lib/server/environment";
import { parseEmailConfirmationLink } from "@/lib/domain/email-confirmation-link";
import { loginEmailError } from "@/lib/domain/login-error";
import { googleProviderEnabled } from "@/lib/domain/google-provider";
import type { ActionResult } from "./actions";
export async function startGoogleLoginAction(
  _state: ActionResult,
): Promise<ActionResult> {
  void _state;
  let authorizationUrl: string;
  try {
    const config = productionConfiguration();
    if (!(await googleProviderEnabled(config)))
      return { error: "Googleログインは現在設定中です。メールでログインしてください。" };
    const client = await createSupabaseClient();
    const { data, error } = await client.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${config.origin}/auth/callback` },
    });
    if (error || !data.url || new URL(data.url).origin !== new URL(config.url).origin)
      return { error: "Googleログインを開始できませんでした。" };
    authorizationUrl = data.url;
  } catch {
    return { error: "Googleログインを開始できませんでした。" };
  }
  redirect(authorizationUrl);
}
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
        "メールを送りました。最新のメールのリンクを一度開くとログインできます。",
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
    destination = actor.role === "admin" ? "/admin" : "/dashboard";
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
    destination = actor.role === "admin" ? "/admin" : "/dashboard";
  } catch {
    return {
      error: "Supabaseから届いた新しい認証リンクを貼り付けてください。",
    };
  }
  redirect(destination);
}
