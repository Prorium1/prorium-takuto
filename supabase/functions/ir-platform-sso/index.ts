import { createClient } from "npm:@supabase/supabase-js@2.117.2";
import {
  challengeFor,
  opaque,
  randomCode,
  sha256,
  verifyPlatformAdmin,
} from "./core.ts";

const headers = {
  "Cache-Control": "private, no-store",
  "Referrer-Policy": "no-referrer",
  "Content-Type": "application/json",
};
export async function handler(request: Request) {
  if (request.method !== "POST")
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers,
    });
  try {
    if (!request.headers.get("content-type")?.startsWith("application/json"))
      throw new Error("Invalid request");
    const raw = await request.text();
    if (raw.length > 4096) throw new Error("Invalid request");
    const input = JSON.parse(raw);
    // Keys are injected by Supabase into this production function, never copied to the app or Git.
    const secretKeys = Deno.env.get("SUPABASE_SECRET_KEYS");
    const key =
      (secretKeys ? JSON.parse(secretKeys).default : null) ||
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const url = Deno.env.get("SUPABASE_URL");
    if (!key || url !== "https://acpwmxehprpcdyrsbfqe.supabase.co")
      throw new Error("Invalid configuration");
    const admin = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    if (input.action === "issue") {
      if (!opaque(input.challenge)) throw new Error("Invalid challenge");
      const token =
        request.headers.get("authorization")?.replace(/^Bearer /, "") || "";
      const platformId = await verifyPlatformAdmin(
        token,
        request.headers.get("x-platform-apikey") || "",
      );
      const code = randomCode();
      const { error } = await admin.rpc("ir_issue_platform_code", {
        p_platform_user: platformId,
        p_code_hash: await sha256(code),
        p_challenge: input.challenge,
      });
      if (error) throw new Error("Access denied");
      return Response.json({ code }, { headers });
    }
    if (input.action === "redeem") {
      if (!opaque(input.code) || !opaque(input.verifier))
        throw new Error("Invalid code");
      const { data, error } = await admin.rpc("ir_redeem_platform_code", {
        p_code_hash: await sha256(input.code),
        p_challenge: await challengeFor(input.verifier),
      });
      if (error || !data?.[0]) throw new Error("Invalid code");
      const target = data[0];
      const {
        data: { user },
        error: userError,
      } = await admin.auth.admin.getUserById(target.ir_user_id);
      if (
        userError ||
        !user?.email ||
        !user.email_confirmed_at ||
        (user.banned_until && Date.parse(user.banned_until) > Date.now())
      )
        throw new Error("Access denied");
      const { data: link, error: linkError } =
        await admin.auth.admin.generateLink({
          type: "magiclink",
          email: user.email,
        });
      if (
        linkError ||
        link.user?.id !== target.ir_user_id ||
        !link.properties?.hashed_token
      )
        throw new Error("Access denied");
      return Response.json(
        {
          token_hash: link.properties.hashed_token,
          user_id: target.ir_user_id,
        },
        { headers },
      );
    }
    throw new Error("Invalid action");
  } catch {
    // Do not log request bodies, platform JWTs, codes, or login tokens.
    return Response.json(
      {
        error:
          "ログイン連携を確認できませんでした。Proriumプラットフォームからやり直してください。",
      },
      { status: 401, headers },
    );
  }
}
Deno.serve(handler);
