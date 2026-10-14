import test from "node:test";
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { emptyReport } from "../src/lib/domain/monthly";

test("ownership staging permits only scoped admin reads, validates source and never changes a report", async () => {
  const db = new PGlite();
  const company = "11111111-1111-1111-1111-111111111111",
    other = "55555555-5555-5555-5555-555555555555";
  const admin = "22222222-2222-2222-2222-222222222222",
    investor = "33333333-3333-3333-3333-333333333333",
    otherAdmin = "44444444-4444-4444-4444-444444444444";
  const actor = (id: string) =>
    db.exec(
      `reset role; set role authenticated; select set_config('request.jwt.claim.sub','${id}',false); select set_config('request.jwt.claims','{"aal":"aal1"}',false);`,
    );
  try {
    await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
      create schema auth; create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz);
      create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
      create function auth.jwt() returns jsonb language sql stable as $$ select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb $$;
      grant usage on schema auth to authenticated,service_role; grant execute on function auth.uid(),auth.jwt() to authenticated,service_role;
      create schema storage; create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
      create table storage.objects(id uuid default gen_random_uuid(),bucket_id text,name text,metadata jsonb default '{}');
      alter table storage.objects enable row level security; grant usage on schema storage to authenticated; grant select,insert,update,delete on storage.objects to authenticated;`);
    for (const path of [
      "database/schema.sql",
      "database/production.sql",
      "supabase/migrations/20261010025805_email_only_admin_access.sql",
      "supabase/migrations/20261014042611_shareholder_ownership_snapshot.sql",
    ])
      await db.exec(await readFile(path, "utf8"));
    const migration = (await readdir("supabase/migrations")).find((name) =>
      name.endsWith("_smartround_ownership_import.sql"),
    );
    assert.ok(migration);
    await db.exec(await readFile(`supabase/migrations/${migration}`, "utf8"));
    await db.exec(`insert into auth.users values ('${admin}','owner@example.test',now()),('${investor}','investor@example.test',now()),('${otherAdmin}','other@example.test',now());
      insert into public.companies(id,name) values ('${company}','Mock Company'),('${other}','Other Company');
      insert into private.admin_memberships(user_id,company_id) values ('${admin}','${company}'),('${otherAdmin}','${other}');`);
    await actor(admin);
    const initial = emptyReport("2026-08", company).content;
    const created = (
      await db.query<{ id: string; revision: number }>(
        "select * from public.ir_create_report($1,'2026-08',$2::jsonb)",
        [company, JSON.stringify(initial)],
      )
    ).rows[0];
    assert.equal(
      (
        await db.query<{ result: unknown }>(
          "select public.ir_get_ownership_import($1) as result",
          [company],
        )
      ).rows[0].result,
      null,
    );
    const snapshot = {
      asOf: "2026-08-31",
      basis: "issued-shares",
      display: "named",
      issuedShares: 1000,
      sourceLabel: "PRIVATE-SOURCE-MOCK-CANARY",
      notes: "架空データ",
      rows: [
        {
          group: "founder",
          name: "Mock 株主A",
          shareClass: "普通株式",
          shares: 1000,
        },
      ],
    };
    await db.exec("reset role");
    for (const invalid of [
      { ...snapshot, issuedShares: 1001 },
      { ...snapshot, asOf: "2099-01-01" },
      { ...snapshot, email: "private@example.invalid" },
    ])
      await assert.rejects(
        db.query(
          "insert into private.ownership_imports(company_id,snapshot) values($1,$2::jsonb)",
          [company, JSON.stringify(invalid)],
        ),
      );
    await assert.rejects(
      db.query(
        "insert into private.ownership_imports(company_id,snapshot,retrieved_at) values($1,$2::jsonb,now()+interval '1 day')",
        [company, JSON.stringify(snapshot)],
      ),
    );
    await db.query(
      "insert into private.ownership_imports(company_id,snapshot) values($1,$2::jsonb)",
      [company, JSON.stringify(snapshot)],
    );
    const metadata = await db.query<{ rls: boolean }>(
      "select relrowsecurity as rls from pg_class where oid='private.ownership_imports'::regclass",
    );
    assert.equal(metadata.rows[0].rls, true);
    await actor(admin);
    await assert.rejects(
      db.query("select * from private.ownership_imports"),
      /permission denied/i,
    );
    const result = (
      await db.query<{ data: { snapshot: unknown; retrievedAt: string } }>(
        "select public.ir_get_ownership_import($1) as data",
        [company],
      )
    ).rows[0].data;
    assert.deepEqual(result.snapshot, snapshot);
    assert.ok(result.retrievedAt);
    const unchanged = (
      await db.query<{ content: typeof initial; revision: number }>(
        "select content,revision from public.report_versions where id=$1",
        [created.id],
      )
    ).rows[0];
    assert.equal(unchanged.revision, created.revision);
    assert.equal(unchanged.content.ownership, undefined);
    assert.deepEqual(unchanged.content.financial, initial.financial);
    await actor(investor);
    await assert.rejects(
      db.query("select public.ir_get_ownership_import($1)", [company]),
      /Admin/,
    );
    await assert.rejects(
      db.query("select * from private.ownership_imports"),
      /permission denied/i,
    );
    await actor(otherAdmin);
    await assert.rejects(
      db.query("select public.ir_get_ownership_import($1)", [company]),
      /Admin/,
    );
    await db.exec("reset role; set role anon");
    await assert.rejects(
      db.query("select public.ir_get_ownership_import($1)", [company]),
      /permission denied/i,
    );
  } finally {
    await db.close();
  }
});
