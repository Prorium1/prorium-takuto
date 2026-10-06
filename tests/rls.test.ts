import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";

test("Postgres RLS blocks drafts, revoked investors, mutations and cross-company access", async () => {
  const db = new PGlite();
  const company = "11111111-1111-1111-1111-111111111111";
  const investor = "22222222-2222-2222-2222-222222222222";
  const admin = "33333333-3333-3333-3333-333333333333";
  const report = "44444444-4444-4444-4444-444444444444";
  const snapshot = "55555555-5555-5555-5555-555555555555";
  const version = "66666666-6666-6666-6666-666666666666";
  const other = "77777777-7777-7777-7777-777777777777";
  try {
    await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
      create schema auth; create table auth.users(id uuid primary key);
      create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
      grant usage on schema auth to authenticated, service_role; grant execute on function auth.uid() to authenticated, service_role;`);
    await db.exec(await readFile("database/schema.sql", "utf8"));
    await db.exec(`insert into auth.users values ('${investor}'),('${admin}');
      insert into public.companies(id,name) values ('${company}','Prorium'),('${other}','Other');
      insert into private.admin_memberships values ('${admin}','${company}',now());
      insert into public.investor_grants(user_id,company_id) values ('${investor}','${company}');
      insert into public.reports(id,company_id,period) values ('${report}','${company}','2026-08-01');
      insert into public.financial_snapshots(id,company_id,period,source,is_synthetic,data) values ('${snapshot}','${company}','2026-08-01','mock',true,'{"currency":"JPY","period":"2026-08"}');
      select set_config('request.jwt.claim.sub','${admin}',false);
      insert into public.report_versions(id,report_id,financial_snapshot_id,version,content) values ('${version}','${report}','${snapshot}','v1.0','{"financial":{"currency":"JPY","period":"2026-08"},"summary":"Mock"}');`);
    await db.exec(
      `set role authenticated; select set_config('request.jwt.claim.sub','${investor}',false);`,
    );
    assert.equal(
      (await db.query("select * from public.report_versions")).rows.length,
      0,
    );
    assert.equal(
      (await db.query("select * from public.reports")).rows.length,
      0,
    );
    assert.equal(
      (await db.query("select * from public.financial_snapshots")).rows.length,
      0,
    );
    await assert.rejects(
      db.exec(
        `update public.report_versions set state='published' where id='${version}'`,
      ),
      /permission denied/,
    );
    await assert.rejects(
      db.exec(
        `insert into private.admin_memberships values ('${investor}','${company}',now())`,
      ),
      /permission denied/,
    );
    await db.exec(
      `reset role; select set_config('request.jwt.claim.sub','${admin}',false);`,
    );
    await assert.rejects(
      db.exec(
        `update public.report_versions set state='published' where id='${version}'`,
      ),
      /approval|transition/i,
    );
    await db.exec(`update public.report_versions set state='review' where id='${version}';
      update public.report_versions set state='approved' where id='${version}';
      update public.report_versions set state='published' where id='${version}';
      insert into public.report_versions(report_id,financial_snapshot_id,version,content) values ('${report}','${snapshot}','v1.1','{"financial":{"currency":"JPY","period":"2026-08"},"summary":"Private draft"}');
      set role authenticated; select set_config('request.jwt.claim.sub','${investor}',false);`);
    const visible = await db.query<{ version: string }>(
      "select version from public.report_versions",
    );
    assert.deepEqual(
      visible.rows.map((r) => r.version),
      ["v1.0"],
    );
    assert.equal(
      (await db.query("select * from public.approval_events")).rows.length,
      0,
    );
    assert.equal(
      (await db.query("select * from public.audit_logs")).rows.length,
      0,
    );
    assert.equal(
      (await db.query("select * from public.analysis_runs")).rows.length,
      0,
    );
    assert.equal(
      (await db.query(`select * from public.companies where id='${other}'`))
        .rows.length,
      0,
    );
    await db.exec(
      `update public.report_versions set content='{}' where id='${version}'`,
    );
    await db.exec(
      `reset role; select set_config('request.jwt.claim.sub','${admin}',false);`,
    );
    await assert.rejects(
      db.exec(
        `update public.report_versions set content='{}' where id='${version}'`,
      ),
      /immutable/i,
    );
    await assert.rejects(
      db.exec(`delete from public.report_versions where id='${version}'`),
      /immutable/i,
    );
    await assert.rejects(
      db.exec(
        `update public.financial_snapshots set data='{}' where id='${snapshot}'`,
      ),
      /immutable/i,
    );
    await assert.rejects(
      db.exec("delete from public.audit_logs"),
      /append.only/i,
    );
    await db.exec(
      `set role authenticated; select set_config('request.jwt.claim.sub','${admin}',false);`,
    );
    assert.equal(
      (await db.query("select * from public.report_versions")).rows.length,
      2,
    );
    await assert.rejects(
      db.exec(
        `update public.report_versions set approved_hash='fake' where id='${version}'`,
      ),
      /permission denied/,
    );
    await db.exec(`reset role; update public.investor_grants set revoked_at=now() where user_id='${investor}';
      set role authenticated; select set_config('request.jwt.claim.sub','${investor}',false);`);
    assert.equal(
      (await db.query("select * from public.report_versions")).rows.length,
      0,
    );
    await db.exec("reset role; set role anon;");
    await assert.rejects(
      db.query("select * from public.report_versions"),
      /permission denied/,
    );
  } finally {
    await db.close();
  }
});
