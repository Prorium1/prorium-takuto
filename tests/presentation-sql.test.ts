import test from "node:test";
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { emptyReport } from "../src/lib/domain/monthly";
test("only the report tenant's admin can read presentation facts and reads cannot mutate reports", async () => {
  const db = new PGlite();
  const company = "11111111-1111-1111-1111-111111111111",
    other = "55555555-5555-5555-5555-555555555555";
  const admin = "22222222-2222-2222-2222-222222222222",
    investor = "33333333-3333-3333-3333-333333333333",
    otherAdmin = "44444444-4444-4444-4444-444444444444";
  async function actor(id: string) {
    await db.exec(
      `reset role; set role authenticated; select set_config('request.jwt.claim.sub','${id}',false); select set_config('request.jwt.claims','{"aal":"aal1"}',false);`,
    );
  }
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
    await db.exec(`create table private.executive_financials(company_id uuid,period date,payload jsonb); alter table private.executive_financials enable row level security;
      insert into auth.users values ('${admin}','owner@example.test',now()),('${investor}','investor@example.test',now()),('${otherAdmin}','other@example.test',now());
      insert into public.companies(id,name) values ('${company}','Mock'),('${other}','Other');
      insert into private.admin_memberships(user_id,company_id) values ('${admin}','${company}'),('${otherAdmin}','${other}');`);
    await actor(admin);
    const initialContent = emptyReport("2026-08", company).content;
    const report = (
      await db.query<{ id: string; revision: number }>(
        "select * from public.ir_create_report($1,'2026-08',$2::jsonb)",
        [company, JSON.stringify(initialContent)],
      )
    ).rows[0];
    await db.exec("reset role");
    await db.query(
      "insert into private.executive_financials values($1,'2026-08-01',$2::jsonb)",
      [
        company,
        JSON.stringify({
          basis: "monthly-net-v2",
          retrievedAt: "2026-09-05T01:30:00Z",
          monthly: { revenue: 1000, operatingProfit: -100 },
          previousYear: { revenue: 800, operatingProfit: -200 },
          statements: { bsTotals: { assets: 5000 } },
          accounts: [{ name: "PRIVATE-ACCOUNT-CANARY" }],
        }),
      ],
    );
    const migration = (await readdir("supabase/migrations")).find((n) =>
      n.endsWith("_owner_presentation.sql"),
    );
    if (migration)
      await db.exec(await readFile(`supabase/migrations/${migration}`, "utf8"));
    await actor(admin);
    const result = (
      await db.query<{ data: { period: string; trend: unknown[] } }>(
        "select public.ir_get_presentation_source($1) as data",
        [report.id],
      )
    ).rows[0].data;
    assert.equal(result.period, "2026-08");
    assert.equal(result.trend.length, 1);
    assert.doesNotMatch(
      JSON.stringify(result),
      /PRIVATE-ACCOUNT-CANARY|accounts/,
    );
    const saved = (
      await db.query<{ revision: number; content: unknown }>(
        "select revision,content from public.report_versions where id=$1",
        [report.id],
      )
    ).rows[0];
    assert.equal(saved.revision, report.revision);
    assert.deepEqual(saved.content, initialContent);
    await assert.rejects(
      db.query("select * from private.executive_financials"),
      /permission denied/i,
    );
    for (const id of [investor, otherAdmin]) {
      await actor(id);
      await assert.rejects(
        db.query("select public.ir_get_presentation_source($1)", [report.id]),
        /Admin authorization/i,
      );
    }
    await db.exec("reset role; set role anon");
    await assert.rejects(
      db.query("select public.ir_get_presentation_source($1)", [report.id]),
      /permission denied/i,
    );
  } finally {
    await db.close();
  }
});
