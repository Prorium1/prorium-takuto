import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import {
  createPlatformAttempt,
  platformAuthorizationUrl,
  validatePlatformCallback,
} from "../src/lib/domain/platform-sso";
import {
  challengeFor,
  verifyPlatformAdmin,
} from "../supabase/functions/ir-platform-sso/core";

test("Platform callback binds browser state, expiry and PKCE without accepting outside destinations", async () => {
  const attempt = createPlatformAttempt(1000);
  const url = new URL(platformAuthorizationUrl(attempt));
  assert.equal(url.origin, "https://dashboard.prorium.co.jp");
  assert.equal(
    url.searchParams.get("challenge"),
    await challengeFor(attempt.verifier),
  );
  const params = new URLSearchParams({
    state: attempt.state,
    code: "a".repeat(43),
    next: "https://outside.test",
  });
  assert.equal(
    validatePlatformCallback(JSON.stringify(attempt), params, 2000).verifier,
    attempt.verifier,
  );
  assert.throws(() => validatePlatformCallback(undefined, params, 2000));
  assert.throws(() =>
    validatePlatformCallback(JSON.stringify(attempt), params, 302000),
  );
  params.set("state", "b".repeat(43));
  assert.throws(() =>
    validatePlatformCallback(JSON.stringify(attempt), params, 2000),
  );
});
test("Platform identity must be verified by Auth and an active administrator profile", async () => {
  const id = "11111111-1111-1111-1111-111111111111";
  let active = true;
  const reader: typeof fetch = async (url, options) => {
    assert.match(String(url), /^https:\/\/mledqwzqtkzqjaoewwlf.supabase.co\//);
    assert.equal(
      (options?.headers as Record<string, string>).Authorization,
      "Bearer verified-token",
    );
    return Response.json(
      String(url).includes("/user")
        ? { id, email_confirmed_at: "2026-01-01" }
        : { id, role: "admin", is_active: active },
    );
  };
  assert.equal(
    await verifyPlatformAdmin("verified-token", "public-key", reader),
    id,
  );
  active = false;
  await assert.rejects(
    verifyPlatformAdmin("verified-token", "public-key", reader),
  );
  await assert.rejects(
    verifyPlatformAdmin(
      "forged-token",
      "public-key",
      async () => new Response("", { status: 401 }),
    ),
  );
});
test("SSO codes are service-only, expire, require matching PKCE, and cannot be reused or elevate unmapped accounts", async () => {
  const db = new PGlite();
  const platform = "11111111-1111-1111-1111-111111111111",
    admin = "22222222-2222-2222-2222-222222222222",
    company = "33333333-3333-3333-3333-333333333333";
  try {
    await db.exec(
      `create role anon; create role authenticated; create role service_role bypassrls; create schema auth; create schema private; create table auth.users(id uuid primary key); create table public.companies(id uuid primary key); create table private.admin_memberships(user_id uuid,company_id uuid); create table public.audit_logs(company_id uuid,actor_id uuid,action text,record_id uuid not null,metadata jsonb); grant usage on schema private to service_role; grant select on private.admin_memberships to service_role; grant insert on public.audit_logs to service_role;`,
    );
    for (const file of ["supabase/migrations/20261011065922_platform_master_sso_storage.sql", "supabase/migrations/20261011070012_platform_master_sso_rpc.sql"])
      await db.exec(await readFile(file,"utf8"));
    await db.exec(
      `insert into auth.users values('${admin}'); insert into public.companies values('${company}'); insert into private.admin_memberships values('${admin}','${company}'); insert into private.platform_admin_links(platform_user_id,ir_user_id,company_id) values('${platform}','${admin}','${company}');`,
    );
    await db.exec("set role authenticated");
    await assert.rejects(
      db.query("select public.ir_issue_platform_code($1,$2,$3)", [
        platform,
        "a".repeat(64),
        "b".repeat(43),
      ]),
      /permission denied/,
    );
    await assert.rejects(
      db.query("select * from private.platform_login_codes"),
      /permission denied/,
    );
    await db.exec("reset role; set role service_role");
    await assert.rejects(
      db.query("select public.ir_issue_platform_code($1,$2,$3)", [
        admin,
        "a".repeat(64),
        "b".repeat(43),
      ]),
      /access denied/,
    );
    await db.query("select public.ir_issue_platform_code($1,$2,$3)", [
      platform,
      "a".repeat(64),
      "b".repeat(43),
    ]);
    await assert.rejects(
      db.query("select * from public.ir_redeem_platform_code($1,$2)", [
        "a".repeat(64),
        "c".repeat(43),
      ]),
      /Invalid/,
    );
    const redeemed = await db.query<{ ir_user_id: string }>(
      "select * from public.ir_redeem_platform_code($1,$2)",
      ["a".repeat(64), "b".repeat(43)],
    );
    assert.equal(redeemed.rows[0].ir_user_id, admin);
    await assert.rejects(
      db.query("select * from public.ir_redeem_platform_code($1,$2)", [
        "a".repeat(64),
        "b".repeat(43),
      ]),
      /Invalid/,
    );
    await db.query("select public.ir_issue_platform_code($1,$2,$3)", [
      platform,
      "d".repeat(64),
      "b".repeat(43),
    ]);
    await db.exec(
      "update private.platform_login_codes set expires_at=now()-interval '1 second' where code_hash=repeat('d',64)",
    );
    await assert.rejects(
      db.query("select * from public.ir_redeem_platform_code($1,$2)", [
        "d".repeat(64),
        "b".repeat(43),
      ]),
      /Invalid/,
    );
    await db.query("select public.ir_issue_platform_code($1,$2,$3)", [
      platform,
      "e".repeat(64),
      "b".repeat(43),
    ]);
    await db.exec(
      "reset role; delete from private.admin_memberships; set role service_role",
    );
    await assert.rejects(
      db.query("select * from public.ir_redeem_platform_code($1,$2)", [
        "e".repeat(64),
        "b".repeat(43),
      ]),
      /access denied/,
    );
  } finally {
    await db.close();
  }
});
