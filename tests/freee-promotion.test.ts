import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { emptyReport } from "../src/lib/domain/monthly";

test("an email-authenticated admin can promote a confirmed stage while investors cannot", async () => {
  const db = new PGlite();
  const company = "11111111-1111-1111-1111-111111111111";
  const admin = "22222222-2222-2222-2222-222222222222";
  const investor = "33333333-3333-3333-3333-333333333333";
  const actor = async (id: string, aal = "aal2") => db.exec(`reset role; set role authenticated; select set_config('request.jwt.claim.sub','${id}',false); select set_config('request.jwt.claims','{"aal":"${aal}"}',false);`);
  try {
    await db.exec(`create role anon; create role authenticated; create role service_role bypassrls; create schema auth; create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz); create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$; create function auth.jwt() returns jsonb language sql stable as $$ select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb $$; grant usage on schema auth to authenticated,service_role; grant execute on function auth.uid(),auth.jwt() to authenticated,service_role;
      create schema storage; create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]); create table storage.objects(id uuid default gen_random_uuid(),bucket_id text,name text,metadata jsonb default '{}'); alter table storage.objects enable row level security; grant usage on schema storage to authenticated; grant select,insert,update,delete on storage.objects to authenticated;`);
    for (const file of ["database/schema.sql", "database/production.sql", "supabase/migrations/20261010025059_email_only_admin_access.sql", "supabase/migrations/20261009012909_freee_connection.sql", "supabase/migrations/20261009021638_freee_staging.sql", "supabase/migrations/20261009022645_promote_freee_stage.sql"])
      await db.exec(await readFile(file, "utf8"));
    await db.exec(await readFile("supabase/migrations/20261009031730_briefing_stories.sql", "utf8"));
    await db.exec(`insert into auth.users values ('${admin}','owner@example.test',now()),('${investor}','investor@example.test',now());`);
    await db.exec(`insert into public.companies(id,name) values ('${company}','Prorium'); insert into private.admin_memberships(user_id,company_id) values ('${admin}','${company}');`);
    const candidate = { period: "2026-08", currency: "JPY", source: "freee", revenue: { current: 100, previous: 80 }, operatingProfit: { current: 20, previous: 10 }, ordinaryProfit: { current: 22, previous: 11 }, cash: { current: 50, previous: 40 }, assets: 300, liabilities: 100, equity: 200, monthlyFixedCosts: null };
    const provenance = { period: "2026-08", closeConfirmed: false, mappingVersion: "synthetic-test" };
    const stage = await db.query<{ id: string }>("insert into private.freee_staged_financials(company_id,period,freee_company_id,candidate,provenance) values($1,'2026-08-01',11486508,$2::jsonb,$3::jsonb) returning id", [company, JSON.stringify(candidate), JSON.stringify(provenance)]);
    const stageId = stage.rows[0].id;
    const content = emptyReport("2026-08", company).content;
    content.financial = { ...content.financial, available: true, source: "freee", revenue: { current: 100, previous: 80, status: "要確認" }, operatingProfit: { current: 20, previous: 10, status: "要確認" }, ordinaryProfit: { current: 22, previous: 11, status: "要確認" }, cash: { current: 50, previous: 40, status: "要確認" }, assets: 300, liabilities: 100, equity: 200, monthlyFixedCosts: 10 };
    content.revenueDrivers = [{ label: "経営者確認", amount: 20, description: "Synthetic documented revenue reason" }];
    content.profitDrivers = [{ label: "経営者確認", amount: 10, description: "Synthetic documented profit reason" }];
    await actor(admin, "aal1");
    await assert.rejects(db.query("select * from public.ir_promote_freee_stage($1,$2::jsonb,false,true,true)", [stageId, JSON.stringify(content)]), /confirmation/i);
    await actor(investor);
    await assert.rejects(db.query("select * from public.ir_promote_freee_stage($1,$2::jsonb,true,true,true)", [stageId, JSON.stringify(content)]), /MFA|Admin/i);
    await actor(admin, "aal1");
    await assert.rejects(db.query("select * from public.ir_promote_freee_stage($1,$2::jsonb,false,true,true)", [stageId, JSON.stringify(content)]), /confirmation/i);
    const wrong = structuredClone(content);
    wrong.financial.revenue.current = 101;
    await assert.rejects(db.query("select * from public.ir_promote_freee_stage($1,$2::jsonb,true,true,true)", [stageId, JSON.stringify(wrong)]), /mismatch/i);
    await db.exec("reset role");
    const partial = await db.query<{ id: string }>("insert into private.freee_staged_financials(company_id,period,freee_company_id,candidate,provenance) values($1,'2026-09-01',11486508,$2::jsonb,$3::jsonb) returning id", [company, JSON.stringify({ ...candidate, period: "2026-09", completeness: "month-to-date" }), JSON.stringify({ ...provenance, period: "2026-09" })]);
    await actor(admin, "aal1");
    await assert.rejects(db.query("select * from public.ir_promote_freee_stage($1,$2::jsonb,true,true,true)", [partial.rows[0].id, JSON.stringify(content)]), /Incomplete month/i);
    const promoted = await db.query<{ state: string; financial_snapshot_id: string }>("select * from public.ir_promote_freee_stage($1,$2::jsonb,true,true,true)", [stageId, JSON.stringify(content)]);
    assert.equal(promoted.rows[0].state, "draft");
    const snapshot = await db.query<{ import_job_id: string; source: string }>("select import_job_id,source from public.financial_snapshots where id=$1", [promoted.rows[0].financial_snapshot_id]);
    assert.equal(snapshot.rows[0].source, "freee");
    assert.ok(snapshot.rows[0].import_job_id);
    await assert.rejects(db.query("update public.financial_snapshots set data='{}' where id=$1", [promoted.rows[0].financial_snapshot_id]), /permission|immutable/i);
    await actor(investor);
    assert.equal((await db.query("select * from public.report_versions")).rows.length, 0);
  } finally { await db.close(); }
});
