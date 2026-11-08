import test from "node:test";
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { fiscalContract } from "../scripts/fiscal-contract";
import { PGlite } from "@electric-sql/pglite";
import { mockFiscalSource } from "../src/lib/mock/fiscal";
import { emptyReport } from "../src/lib/domain/monthly";
import {
  emptyFiscalEditor,
  fiscalPublicationContentSchema,
} from "../src/lib/domain/fiscal-publication";
test("annual sharing enforces tenant membership, human review, stale revision checks and immutable published data", async () => {
  const db = new PGlite(),
    company = "11111111-1111-1111-1111-111111111111",
    other = "55555555-5555-5555-5555-555555555555",
    admin = "22222222-2222-2222-2222-222222222222",
    investor = "33333333-3333-3333-3333-333333333333",
    outsider = "44444444-4444-4444-4444-444444444444",
    year = new Date().getUTCFullYear() - 1,
    source = mockFiscalSource(year);
  const actor = async (id: string) =>
    db.exec(
      `reset role;set role authenticated;select set_config('request.jwt.claim.sub','${id}',false);select set_config('request.jwt.claims','{"aal":"aal1"}',false);`,
    );
  try {
    await db.exec(
      `create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;create function auth.jwt() returns jsonb language sql stable as $$select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb$$;grant usage on schema auth to authenticated;grant execute on function auth.uid(),auth.jwt() to authenticated;`,
    );
    await db.exec(await readFile("database/schema.sql", "utf8"));
    await db.exec(
      "create schema storage;create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);create table storage.objects(id uuid default gen_random_uuid(),bucket_id text,name text,metadata jsonb default '{}');alter table storage.objects enable row level security;grant usage on schema storage to authenticated;grant select,insert,update,delete on storage.objects to authenticated;",
    );
    await db.exec(await readFile("database/production.sql", "utf8"));
    await db.exec(
      await readFile(
        "supabase/migrations/20261010025805_email_only_admin_access.sql",
        "utf8",
      ),
    );
    await db.exec(
      `insert into auth.users values('${admin}','owner@example.test',now()),('${investor}','investor@example.test',now()),('${outsider}','other@example.test',now());insert into public.companies(id,name) values('${company}','Mock'),('${other}','Other');insert into private.admin_memberships(user_id,company_id) values('${admin}','${company}'),('${outsider}','${other}');insert into public.investor_grants(company_id,user_id) values('${company}','${investor}');create table private.executive_financials(company_id uuid,period date,payload jsonb);`,
    );
    for (const suffix of [
      "_shareholder_ownership_snapshot.sql",
      "_smartround_ownership_import.sql",
      "_fiscal_briefing.sql",
      "_fiscal_management_summary.sql",
      "_fiscal_investor_publication.sql",
    ]) {
      const file = (await readdir("supabase/migrations")).find((n) =>
        n.endsWith(suffix),
      );
      assert.ok(file);
      await db.exec(await readFile(`supabase/migrations/${file}`, "utf8"));
    }
    await db.query(
      "insert into private.ir_invitations(company_id,email,role,active) values($1,'investor@example.test','investor',true)",
      [company],
    );
    await db.query(
      "update public.investor_grants set invitation_email='investor@example.test' where user_id=$1",
      [investor],
    );
    assert.deepEqual(
      (
        await db.query<{ contract: unknown }>(
          "select private.fiscal_content_contract() contract",
        )
      ).rows[0].contract,
      fiscalContract(),
    );
    await db.query(
      "insert into private.fiscal_briefing_context(company_id,fiscal_end_year,context) values($1,$2,$3)",
      [
        company,
        year,
        JSON.stringify({
          previousFiscalYear: source.previousFiscalYear,
          outlook: source.outlook,
          managementSummary: source.managementSummary,
        }),
      ],
    );
    for (const m of source.months)
      await db.query(
        "insert into private.executive_financials values($1,$2,$3)",
        [
          company,
          `${m.period}-01`,
          JSON.stringify({
            ...m,
            basis: "monthly-net-v2",
            statements: { bsTotals: m.bsTotals },
            secret: "PRIVATE-CANARY",
          }),
        ],
      );
    await actor(admin);
    const monthly = emptyReport(`${year}-08`, company).content;
    monthly.eventSpotlight = {
      title: "Mock 大会",
      occurredOn: `${year}-06-01`,
      summary: "架空の大会記録",
      nextAction: "",
      videoTitle: "Mock 映像",
      videoUrl: "https://www.youtube.com/watch?v=abcdefghijk",
      outcomes: [],
    };
    await db.query("select public.ir_create_report($1,$2,$3)", [
      company,
      `${year}-08`,
      JSON.stringify(monthly),
    ]);
    // A private nested extra or missing opening month must fail before INSERT.
    await db.exec("reset role");
    await db.query(
      "update private.fiscal_briefing_context set context=jsonb_set(context,'{managementSummary,internalSourceUrl}','\"PRIVATE-NESTED-CANARY\"') where company_id=$1",
      [company],
    );
    await actor(admin);
    await assert.rejects(
      db.query("select public.ir_prepare_fiscal_publication($1,$2)", [
        company,
        year,
      ]),
      /Invalid fiscal/i,
    );
    assert.equal(
      (await db.query("select * from public.fiscal_publications")).rows.length,
      0,
    );
    await db.exec("reset role");
    await db.query(
      "update private.fiscal_briefing_context set context=context #- '{managementSummary,internalSourceUrl}' where company_id=$1",
      [company],
    );
    await db.query(
      "update private.executive_financials set period=period+interval '1 month' where company_id=$1",
      [company],
    );
    await actor(admin);
    await assert.rejects(
      db.query("select public.ir_prepare_fiscal_publication($1,$2)", [
        company,
        year,
      ]),
      /Invalid fiscal/i,
    );
    await db.exec("reset role");
    await db.query(
      "update private.executive_financials set period=period-interval '1 month' where company_id=$1",
      [company],
    );
    await db.query(
      "update private.fiscal_briefing_context set context=jsonb_set(context,'{managementSummary}','null') where company_id=$1",
      [company],
    );
    await db.query(
      "insert into private.ownership_imports(company_id,snapshot) values($1,$2)",
      [
        company,
        JSON.stringify({
          asOf: source.asOf,
          basis: "issued-shares",
          display: "grouped",
          issuedShares: 100,
          sourceLabel: "Mock registry",
          notes: "",
          rows: [
            { group: "founder", name: "", shareClass: "普通株式", shares: 100 },
          ],
        }),
      ],
    );
    await actor(admin);
    const created = await db.query<{ id: string }>(
      "select id from public.ir_prepare_fiscal_publication($1,$2)",
      [company, year],
    );
    const id = created.rows[0].id;
    // An incomplete draft can recover after a source correction without losing edits.
    await db.exec("reset role");
    await db.query(
      "update private.fiscal_briefing_context set context=jsonb_set(context,'{managementSummary}',$2) where company_id=$1",
      [company, JSON.stringify(source.managementSummary)],
    );
    await actor(admin);
    await db.query("select public.ir_refresh_fiscal_publication($1,1)", [id]);
    const refreshed = (
      await db.query<{ content: unknown; revision: number }>(
        "select content,revision from public.fiscal_publications where id=$1",
        [id],
      )
    ).rows[0];
    const content = fiscalPublicationContentSchema.parse(refreshed.content);
    assert.ok(content.source.managementSummary);
    assert.equal(content.ownership?.issuedShares, 100);
    assert.equal(content.video?.videoUrl, monthly.eventSpotlight.videoUrl);
    assert.equal(refreshed.revision, 2);
    await actor(investor);
    assert.equal(
      (await db.query("select * from public.fiscal_publications")).rows.length,
      0,
    );
    await assert.rejects(
      db.query("select public.ir_prepare_fiscal_publication($1,$2)", [
        company,
        year,
      ]),
      /Admin/,
    );
    await actor(outsider);
    assert.equal(
      (await db.query("select * from public.fiscal_publications")).rows.length,
      0,
    );
    await assert.rejects(
      db.query("select public.ir_fiscal_transition($1,2,'publish',true)", [id]),
      /Admin/,
    );
    await actor(admin);
    await assert.rejects(
      db.query("select public.ir_fiscal_transition($1,2,'publish',true)", [id]),
      /transition|approval/i,
    );
    await assert.rejects(
      db.query("select public.ir_fiscal_transition($1,2,'review',true)", [id]),
      /complete|confirm/i,
    );
    const editor = emptyFiscalEditor(source.asOf);
    editor.organization = {
      ...editor.organization,
      employees: 8,
      onLeave: 2,
      confirmed: true,
    };
    editor.notes.risks = "Mock:未締め月を含みます。";
    for (const sourceLabel of [
      "\t\t",
      "\u00a0\u00a0",
      "😀",
      "😀".repeat(200),
    ]) {
      await assert.rejects(
        db.query("select public.ir_edit_fiscal_publication($1,2,$2)", [
          id,
          JSON.stringify({
            ...editor,
            organization: { ...editor.organization, sourceLabel },
          }),
        ]),
        /Invalid fiscal/i,
      );
    }
    await db.query("select public.ir_edit_fiscal_publication($1,2,$2)", [
      id,
      JSON.stringify(editor),
    ]);
    await assert.rejects(
      db.query("select public.ir_fiscal_transition($1,2,'review',true)", [id]),
      /revision/i,
    );
    await assert.rejects(
      db.query("select public.ir_fiscal_transition($1,3,'review',false)", [id]),
      /confirm/i,
    );
    await db.query("select public.ir_fiscal_transition($1,3,'review',true)", [
      id,
    ]);
    await db.query("select public.ir_fiscal_transition($1,4,'approve',false)", [
      id,
    ]);
    await db.query("select public.ir_edit_fiscal_publication($1,5,$2)", [
      id,
      JSON.stringify({
        ...editor,
        notes: { ...editor.notes, risks: "Mock:変更後のリスク" },
      }),
    ]);
    await assert.rejects(
      db.query("select public.ir_fiscal_transition($1,6,'publish',true)", [id]),
      /transition|approval/i,
    );
    await db.query("select public.ir_fiscal_transition($1,6,'review',true)", [
      id,
    ]);
    await db.query("select public.ir_fiscal_transition($1,7,'approve',false)", [
      id,
    ]);
    await db.query("select public.ir_refresh_fiscal_publication($1,8)", [id]);
    await assert.rejects(
      db.query("select public.ir_fiscal_transition($1,9,'publish',false)", [
        id,
      ]),
      /transition|approval/i,
    );
    const reset = (
      await db.query<{
        state: string;
        approved_hash: unknown;
        review_hash: unknown;
      }>(
        "select state,approved_hash,review_hash from public.fiscal_publications where id=$1",
        [id],
      )
    ).rows[0];
    assert.deepEqual(reset, {
      state: "draft",
      approved_hash: null,
      review_hash: null,
    });
    await db.query("select public.ir_fiscal_transition($1,9,'review',true)", [
      id,
    ]);
    await db.query(
      "select public.ir_fiscal_transition($1,10,'approve',false)",
      [id],
    );
    await db.query(
      "select public.ir_fiscal_transition($1,11,'publish',false)",
      [id],
    );
    await actor(investor);
    const published = (
      await db.query<{ content: unknown }>(
        "select content from public.fiscal_publications",
      )
    ).rows;
    assert.equal(published.length, 1);
    assert.doesNotMatch(
      JSON.stringify(published),
      /PRIVATE-CANARY|example.test\/school/,
    );
    await assert.rejects(
      db.query("update public.fiscal_publications set state='draft'"),
      /permission denied/i,
    );
    await actor(admin);
    await assert.rejects(
      db.query("select public.ir_edit_fiscal_publication($1,12,$2)", [
        id,
        JSON.stringify(editor),
      ]),
      /immutable/i,
    );
    await assert.rejects(
      db.query("select public.ir_refresh_fiscal_publication($1,12)", [id]),
      /immutable/i,
    );
    await db.exec("reset role");
    await assert.rejects(
      db.query(
        "update public.fiscal_publications set content=content||'{\"changed\":true}' where id=$1",
        [id],
      ),
      /immutable/i,
    );
    await db.query(
      "update private.executive_financials set payload=jsonb_set(payload,'{monthly,revenue}','999999') where company_id=$1",
      [company],
    );
    await actor(investor);
    assert.deepEqual(
      (await db.query("select content from public.fiscal_publications")).rows,
      published,
    );
    await actor(outsider);
    assert.equal(
      (await db.query("select * from public.fiscal_publications")).rows.length,
      0,
    );
    await db.exec("reset role;set role anon");
    await assert.rejects(
      db.query("select * from public.fiscal_publications"),
      /permission denied/i,
    );
  } finally {
    await db.close();
  }
});
