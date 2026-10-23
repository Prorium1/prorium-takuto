import test from "node:test";
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { mockFiscalSource } from "../src/lib/mock/fiscal";
test("fiscal source is tenant-admin only, projects aggregates only, excludes partial months and performs no writes", async () => {
  const db = new PGlite();
  const company = "11111111-1111-1111-1111-111111111111",
    other = "55555555-5555-5555-5555-555555555555";
  const admin = "22222222-2222-2222-2222-222222222222",
    investor = "33333333-3333-3333-3333-333333333333",
    otherAdmin = "44444444-4444-4444-4444-444444444444";
  const year = new Date().getUTCFullYear() - 1,
    source = mockFiscalSource(year);
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
    ])
      await db.exec(await readFile(path, "utf8"));
    await db.exec(`create table private.executive_financials(company_id uuid,period date,payload jsonb); alter table private.executive_financials enable row level security;
      insert into auth.users values ('${admin}','owner@example.test',now()),('${investor}','investor@example.test',now()),('${otherAdmin}','other@example.test',now());
      insert into public.companies(id,name) values ('${company}','Mock'),('${other}','Other');
      insert into private.admin_memberships(user_id,company_id) values ('${admin}','${company}'),('${otherAdmin}','${other}');`);
    const migration = (await readdir("supabase/migrations")).find((n) =>
      n.endsWith("_fiscal_briefing.sql"),
    );
    assert.ok(migration);
    await db.exec(await readFile(`supabase/migrations/${migration}`, "utf8"));
    const summaryMigration = (await readdir("supabase/migrations")).find((n) =>
      n.endsWith("_fiscal_management_summary.sql"),
    );
    assert.ok(summaryMigration);
    await db.exec(
      await readFile(`supabase/migrations/${summaryMigration}`, "utf8"),
    );
    await db.query(
      "insert into private.fiscal_briefing_context(company_id,fiscal_end_year,context) values($1,$2,$3::jsonb)",
      [
        company,
        year,
        JSON.stringify({
          previousFiscalYear: source.previousFiscalYear,
          outlook: source.outlook,
          managementSummary: source.managementSummary,
          privateMemo: "PRIVATE-CONTEXT-CANARY",
        }),
      ],
    );
    for (const m of source.months)
      await db.query(
        "insert into private.executive_financials values($1,$2,$3::jsonb)",
        [
          company,
          `${m.period}-01`,
          JSON.stringify({
            ...m,
            basis: "monthly-net-v2",
            statements: { bsTotals: m.bsTotals },
            accounts: ["PRIVATE-ACCOUNT-CANARY"],
          }),
        ],
      );
    await db.query(
      "insert into private.executive_financials values($1,$2,$3::jsonb)",
      [
        company,
        `${year}-10-01`,
        JSON.stringify({
          basis: "legacy-cumulative",
          monthly: { revenue: 999999 },
        }),
      ],
    );
    const tokyoToday = new Intl.DateTimeFormat("sv-SE", {
      timeZone: "Asia/Tokyo",
    }).format(new Date());
    const currentFiscalYear =
      Number(tokyoToday.slice(0, 4)) +
      (Number(tokyoToday.slice(5, 7)) >= 11 ? 1 : 0);
    await db.query(
      "insert into private.fiscal_briefing_context(company_id,fiscal_end_year,context) values($1,$2,'{}')",
      [company, currentFiscalYear],
    );
    await db.query(
      "insert into private.executive_financials values($1,date_trunc('month',timezone('Asia/Tokyo',now()))::date,$2::jsonb)",
      [
        company,
        JSON.stringify({
          basis: "monthly-net-v2",
          monthly: { revenue: 999999 },
          privateMemo: "CURRENT-MONTH-CANARY",
        }),
      ],
    );
    await actor(admin);
    assert.equal(
      (
        await db.query<{ data: unknown }>(
          "select public.ir_get_fiscal_briefing($1,$2) as data",
          [company, currentFiscalYear],
        )
      ).rows[0].data,
      null,
    );
    const r = (
      await db.query<{
        data: {
          months: unknown[];
          previousFiscalYear: unknown[];
          outlook: { targetRevenue: number };
          managementSummary: unknown;
        };
      }>("select public.ir_get_fiscal_briefing($1,$2) as data", [company, year])
    ).rows[0].data;
    assert.deepEqual(r.managementSummary, source.managementSummary);
    await db.exec("reset role");
    await db.query(
      "update private.fiscal_briefing_context set context=context-'managementSummary' where company_id=$1 and fiscal_end_year=$2",
      [company, year],
    );
    await actor(admin);
    const legacy = (
      await db.query<{ data: Record<string, unknown> }>(
        "select public.ir_get_fiscal_briefing($1,$2) as data",
        [company, year],
      )
    ).rows[0].data;
    assert.equal(Object.hasOwn(legacy, "managementSummary"), false);
    assert.equal(r.months.length, 11);
    assert.equal(r.previousFiscalYear.length, 12);
    assert.equal(r.outlook.targetRevenue, source.outlook?.targetRevenue);
    assert.doesNotMatch(JSON.stringify(r), /PRIVATE-|CURRENT-MONTH|accounts/);
    await assert.rejects(
      db.query("select * from private.fiscal_briefing_context"),
      /permission denied/i,
    );
    await assert.rejects(
      db.query("select public.ir_get_fiscal_briefing($1,$2)", [other, year]),
      /Admin authorization/i,
    );
    for (const id of [investor, otherAdmin]) {
      await actor(id);
      await assert.rejects(
        db.query("select public.ir_get_fiscal_briefing($1,$2)", [
          company,
          year,
        ]),
        /Admin authorization/i,
      );
    }
    for (const role of ["anon", "service_role"]) {
      await db.exec(`reset role;set role ${role}`);
      await assert.rejects(
        db.query("select public.ir_get_fiscal_briefing($1,$2)", [
          company,
          year,
        ]),
        /permission denied/i,
      );
    }
    await db.exec("reset role");
    assert.equal(
      (
        await db.query<{ count: number }>(
          "select count(*)::int as count from public.report_versions",
        )
      ).rows[0].count,
      0,
    );
    assert.equal(
      (
        await db.query<{ count: number }>(
          "select count(*)::int as count from private.fiscal_briefing_context",
        )
      ).rows[0].count,
      2,
    );
  } finally {
    await db.close();
  }
});
