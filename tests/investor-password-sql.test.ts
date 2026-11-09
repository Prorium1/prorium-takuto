import test from "node:test";
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";

test("investor password reservations isolate callers and identities, serialize issuance, and keep secrets out of records", async () => {
  const db = new PGlite(),
    company = "11111111-1111-1111-1111-111111111111",
    other = "55555555-5555-5555-5555-555555555555",
    owner = "22222222-2222-2222-2222-222222222222",
    investor = "33333333-3333-3333-3333-333333333333",
    outsider = "44444444-4444-4444-4444-444444444444",
    fresh = "66666666-6666-6666-6666-666666666666";
  const actor = async (id: string) =>
    db.exec(
      `reset role;set role authenticated;select set_config('request.jwt.claim.sub','${id}',false);select set_config('request.jwt.claims','{"role":"authenticated"}',false);`,
    );
  const service = async () =>
    db.exec(
      `reset role;set role service_role;select set_config('request.jwt.claim.sub','',false);select set_config('request.jwt.claims','{"role":"service_role"}',false);`,
    );
  const reserve = async (
    email: string,
    mode = "issue",
    ack = true,
    tenant = company,
  ) =>
    (
      await db.query<{
        value: {
          requestId: string;
          email: string;
          targetUserId: string | null;
        };
      }>("select public.ir_reserve_investor_password($1,$2,$3,$4) value", [
        tenant,
        email,
        mode,
        ack,
      ])
    ).rows[0].value;
  const complete = async (email: string, request: string, user = investor) =>
    db.query("select public.ir_complete_investor_password($1,$2,$3,$4,$5)", [
      company,
      email,
      request,
      owner,
      user,
    ]);
  try {
    await db.exec(
      `create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz,raw_app_meta_data jsonb default '{}');create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;create function auth.jwt() returns jsonb language sql stable as $$select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb$$;grant usage on schema auth to authenticated,service_role;grant execute on function auth.uid(),auth.jwt() to authenticated,service_role;create schema storage;create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);create table storage.objects(id uuid default gen_random_uuid(),bucket_id text,name text,metadata jsonb default '{}');alter table storage.objects enable row level security;grant usage on schema storage to authenticated;grant select,insert,update,delete on storage.objects to authenticated;`,
    );
    await db.exec(await readFile("database/schema.sql", "utf8"));
    await db.exec(await readFile("database/production.sql", "utf8"));
    await db.exec(
      await readFile(
        "supabase/migrations/20261010025805_email_only_admin_access.sql",
        "utf8",
      ),
    );
    const migration = (await readdir("supabase/migrations")).find((f) =>
      f.endsWith("_investor_password_issuance.sql"),
    );
    assert.ok(migration);
    await db.exec(await readFile(`supabase/migrations/${migration}`, "utf8"));
    await db.exec(
      `insert into auth.users(id,email,email_confirmed_at) values('${owner}','owner@example.test',now()),('${investor}','investor@example.test',now()),('${outsider}','other@example.test',now());insert into public.companies(id,name) values('${company}','Mock'),('${other}','Other');insert into private.admin_memberships(user_id,company_id) values('${owner}','${company}'),('${outsider}','${other}');`,
    );
    await actor(owner);
    await db.query(
      "select public.ir_set_invitation($1,'investor@example.test',true)",
      [company],
    );
    // An unrelated Auth account is never reset, even if its email was added to the invitation list.
    await assert.rejects(reserve("investor@example.test"), /UNRELATED_ACCOUNT/);
    await actor(investor);
    await db.query("select public.ir_accept_invitation($1)", [company]);
    for (const id of [investor, outsider]) {
      await actor(id);
      await assert.rejects(reserve("investor@example.test"), /ADMIN_REQUIRED/);
      await assert.rejects(
        db.query("select * from public.ir_list_investor_access($1)", [company]),
        /ADMIN_REQUIRED/,
      );
      await assert.rejects(
        db.query("select * from private.ir_investor_credentials"),
        /permission denied/,
      );
    }
    await db.exec("reset role;set role anon");
    await assert.rejects(reserve("investor@example.test"), /permission denied/);
    await actor(owner);
    await assert.rejects(
      reserve("investor@example.test", "issue", true, other),
      /ADMIN_REQUIRED/,
    );
    await assert.rejects(reserve("owner@example.test", "create"), /PROTECTED/);
    await assert.rejects(reserve("other@example.test", "create"), /PROTECTED/);
    await assert.rejects(
      reserve("investor@example.test", "issue", false),
      /ACK_REQUIRED/,
    );
    const first = await reserve(" Investor@example.test ");
    assert.equal(first.targetUserId, investor);
    assert.equal(first.email, "investor@example.test");
    await assert.rejects(reserve("investor@example.test"), /BUSY/);
    await assert.rejects(
      complete(first.email, first.requestId),
      /permission denied/,
    );
    await service();
    await assert.rejects(complete(first.email, fresh), /STALE/);
    await assert.rejects(
      complete(first.email, first.requestId, outsider),
      /IDENTITY_CHANGED/,
    );
    await complete(first.email, first.requestId);
    await assert.rejects(complete(first.email, first.requestId), /STALE/);
    await actor(owner);
    await assert.rejects(reserve(first.email), /ALREADY_ISSUED/);
    const second = await reserve(first.email, "reset");
    await db.exec("reset role");
    await db.query(
      "update private.ir_investor_credentials set requested_at=now()-interval '3 minutes' where company_id=$1",
      [company],
    );
    await service();
    await assert.rejects(complete(second.email, second.requestId), /STALE/);
    await actor(owner);
    const third = await reserve(first.email, "reset");
    await service();
    await assert.rejects(complete(second.email, second.requestId), /STALE/);
    await db.exec("reset role");
    await db.query("delete from private.admin_memberships where user_id=$1", [
      owner,
    ]);
    await service();
    await assert.rejects(complete(third.email, third.requestId), /INACTIVE/);
    await db.exec("reset role");
    await db.query(
      "insert into private.admin_memberships(user_id,company_id) values($1,$2)",
      [owner, company],
    );
    await actor(owner);
    await db.query("select public.ir_set_invitation($1,$2,false)", [
      company,
      first.email,
    ]);
    await service();
    await assert.rejects(complete(third.email, third.requestId), /INACTIVE/);
    await actor(owner);
    await assert.rejects(reserve(first.email, "reset"), /INACTIVE/);
    const created = await reserve("new@example.test", "create", false);
    assert.equal(created.targetUserId, null);
    await db.exec("reset role");
    await db.query(
      "insert into auth.users(id,email,email_confirmed_at,raw_app_meta_data) values($1,$2,now(),$3)",
      [
        fresh,
        created.email,
        JSON.stringify({
          ir_credential_company: company,
          ir_invitation_email: created.email,
        }),
      ],
    );
    await service();
    await complete(created.email, created.requestId, fresh);
    await actor(fresh);
    await db.query("select public.ir_accept_invitation($1)", [company]);
    assert.equal(
      (
        await db.query<{ value: { role: string } }>(
          "select public.ir_current_actor($1) value",
          [company],
        )
      ).rows[0].value.role,
      "investor",
    );
    await db.exec("reset role");
    await db.query(
      "update auth.users set email='changed@example.test' where id=$1",
      [fresh],
    );
    await actor(owner);
    await assert.rejects(reserve(created.email, "reset"), /IDENTITY_CHANGED/);
    await db.exec("reset role");
    await db.query(
      "insert into public.investor_grants(company_id,user_id) values($1,$2)",
      [other, fresh],
    );
    await actor(owner);
    await assert.rejects(
      reserve("changed@example.test", "create"),
      /PROTECTED/,
    );
    await db.exec("reset role");
    const records = (
      await db.query<Record<string, unknown>>(
        "select * from private.ir_investor_credentials",
      )
    ).rows;
    assert.equal(records.length, 2);
    assert.ok(records.every((row) => !("password" in row)));
    const audit = JSON.stringify(
      (
        await db.query(
          "select metadata from public.audit_logs where action like 'investor-password-%'",
        )
      ).rows,
    );
    assert.ok(!audit.includes("password"));
    assert.ok(audit.includes("investor@example.test"));
    assert.equal(
      (
        await db.query<{ relrowsecurity: boolean }>(
          "select relrowsecurity from pg_class where oid='private.ir_investor_credentials'::regclass",
        )
      ).rows[0].relrowsecurity,
      true,
    );
  } finally {
    await db.close();
  }
});
