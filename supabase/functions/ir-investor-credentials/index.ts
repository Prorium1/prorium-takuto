import { createClient } from "npm:@supabase/supabase-js@2.117.2";
import {
  CredentialError,
  credentialInput,
  issueInvestorCredentials,
  passwordError,
} from "./core.ts";

const headers = {
  "Cache-Control": "private, no-store",
  "Content-Type": "application/json",
  "Referrer-Policy": "no-referrer",
};
export async function handler(request: Request) {
  if (request.method !== "POST")
    return Response.json({ error: "invalid" }, { status: 405, headers });
  try {
    if (!request.headers.get("content-type")?.startsWith("application/json"))
      throw new CredentialError("invalid");
    const token = request.headers
      .get("authorization")
      ?.match(/^Bearer ([A-Za-z0-9_.-]+)$/)?.[1];
    if (!token || token.length > 8000) throw new CredentialError("denied");
    const raw = await request.text();
    if (raw.length > 2048) throw new CredentialError("invalid");
    const input = credentialInput(JSON.parse(raw));
    const keys = Deno.env.get("SUPABASE_SECRET_KEYS"),
      publicKeys = Deno.env.get("SUPABASE_PUBLISHABLE_KEYS");
    const key =
      (keys ? JSON.parse(keys).default : null) ||
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const publicKey =
      (publicKeys ? JSON.parse(publicKeys).default : null) ||
      Deno.env.get("SUPABASE_ANON_KEY");
    const url = Deno.env.get("SUPABASE_URL");
    if (
      !key ||
      !publicKey ||
      url !== "https://acpwmxehprpcdyrsbfqe.supabase.co"
    )
      throw new CredentialError("unavailable");
    const timedFetch: typeof fetch = (resource, init) =>
      fetch(resource, { ...init, signal: AbortSignal.timeout(10_000) });
    const options = {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { fetch: timedFetch },
    };
    const admin = createClient(url, key, options);
    const caller = createClient(url, publicKey, {
      ...options,
      global: {
        fetch: timedFetch,
        headers: { Authorization: `Bearer ${token}` },
      },
    });
    const credentials = await issueInvestorCredentials(input, {
      async authorize() {
        const {
          data: { user },
          error,
        } = await caller.auth.getUser(token);
        if (error || !user) return null;
        const { data: actor, error: roleError } = await caller.rpc(
          "ir_current_actor",
          { p_company: input.companyId },
        );
        return roleError || actor?.id !== user.id ? null : actor;
      },
      async reserve(i) {
        const { data, error } = await caller.rpc(
          "ir_reserve_investor_password",
          {
            p_company: i.companyId,
            p_email: i.email,
            p_mode: i.mode,
            p_acknowledged: i.acknowledged,
          },
        );
        if (error) throw passwordError(error.message);
        return data;
      },
      async create(email, password, companyId) {
        const { data, error } = await admin.auth.admin.createUser({
          email,
          password,
          email_confirm: true,
          app_metadata: {
            ir_credential_company: companyId,
            ir_invitation_email: email,
          },
        });
        if (error || !data.user) throw new CredentialError("unavailable");
        return data.user;
      },
      async update(userId, email, password) {
        // Recheck the stable identity immediately before a password mutation.
        const { data: current, error: identityError } =
          await admin.auth.admin.getUserById(userId);
        if (identityError || current.user?.email?.toLowerCase() !== email)
          throw new CredentialError("identity-changed");
        const { data, error } = await admin.auth.admin.updateUserById(userId, {
          password,
          email_confirm: true,
        });
        if (error || !data.user) throw new CredentialError("unavailable");
        return data.user;
      },
      async complete(i, requestId, actorId, userId) {
        const { data, error } = await admin.rpc(
          "ir_complete_investor_password",
          {
            p_company: i.companyId,
            p_email: i.email,
            p_request: requestId,
            p_actor: actorId,
            p_user: userId,
          },
        );
        return !error && data === true;
      },
    });
    return Response.json(credentials, { headers });
  } catch (error) {
    // Do not log request bodies, passwords, Auth responses or tokens.
    const code = error instanceof CredentialError ? error.code : "unavailable";
    return Response.json(
      { error: code },
      {
        status: code === "denied" ? 403 : code === "invalid" ? 400 : 409,
        headers,
      },
    );
  }
}
Deno.serve(handler);
