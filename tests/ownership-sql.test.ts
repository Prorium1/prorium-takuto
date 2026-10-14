import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { emptyReport } from "../src/lib/domain/monthly";

test("production RPC validates ownership and preserves tenant, draft, approval and snapshot boundaries", async () => {
  const db = new PGlite();
  const company = "11111111-1111-1111-1111-111111111111";
  const admin = "22222222-2222-2222-2222-222222222222";
  const investor = "33333333-3333-3333-3333-333333333333";
  const other = "44444444-4444-4444-4444-444444444444";
  const actor = async (id: string) =>
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
    for (const file of [
      "database/schema.sql",
      "database/production.sql",
      "20261010025805_email_only_admin_access",
      "20261009012909_freee_connection",
      "20261009021638_freee_staging",
      "20261009022645_promote_freee_stage",
      "20261009031730_briefing_stories",
      "20261009031746_event_spotlight",
      "20261010033622_freee_context_gate",
      "20261011113944_executive_finance_gateway",
    ])
      await db.exec(
        await readFile(
          file.startsWith("database/")
            ? file
            : `supabase/migrations/${file}.sql`,
          "utf8",
        ),
      );
    await db.exec(`insert into auth.users values ('${admin}','owner@example.test',now()),('${investor}','investor@example.test',now()),('${other}','other@example.test',now());
      insert into public.companies(id,name) values ('${company}','Mock Company');
      insert into private.admin_memberships(user_id,company_id) values ('${admin}','${company}');`);
    const content = emptyReport("2026-08", company).content;
    content.summary.text = "Mockの月次報告です。";
    content.ceo.message = "架空の報告について確認しました。";
    content.ownership = {
      asOf: "2026-08-31",
      basis: "issued-shares",
      display: "named",
      issuedShares: 1000,
      sourceLabel: "Mockの確認用名簿",
      notes: "架空データのみ",
      rows: [
        {
          group: "founder",
          name: "Mock 株主A",
          shareClass: "普通株式",
          shares: 1000,
        },
      ],
    };
    await actor(admin);
    // Reproduce the previous production failure before applying the migration.
    await assert.rejects(
      db.query(
        "select * from public.ir_create_report($1,'2026-08',$2::jsonb)",
        [company, JSON.stringify(content)],
      ),
      /Invalid report content/,
    );
    await db.exec("reset role");
    await db.exec(
      await readFile(
        "supabase/migrations/20261014041134_shareholder_ownership_snapshot.sql",
        "utf8",
      ),
    );
    const helper = await db.query<{ readable: boolean }>(
      "select has_function_privilege('authenticated','private.validate_ownership(jsonb)','execute') as readable",
    );
    assert.equal(helper.rows[0].readable, false);
    await actor(admin);
    const created = (
      await db.query<{ id: string; revision: number }>(
        "select * from public.ir_create_report($1,'2026-08',$2::jsonb)",
        [company, JSON.stringify(content)],
      )
    ).rows[0];
    const id = created.id;
    const ownership = content.ownership!;
    for (const invalid of [
      { ...ownership, issuedShares: 1001 },
      { ...ownership, issuedShares: 0 },
      { ...ownership, asOf: "2099-01-01" },
      { ...ownership, display: "grouped" },
      { ...ownership, rows: [{ ...ownership.rows[0], name: "" }] },
      { ...ownership, rows: [{ ...ownership.rows[0], shares: -1 }] },
      { ...ownership, rows: [{ ...ownership.rows[0], shares: 1.5 }] },
      { ...ownership, email: "private@example.invalid" },
      {
        ...ownership,
        rows: [{ ...ownership.rows[0], secret: "PRIVATE-CANARY" }],
      },
      { ...ownership, asOf: "2026-02-30" },
      { ...ownership, notes: null },
      { ...ownership, rows: null },
      { ...ownership, rows: [] },
    ])
      await assert.rejects(
        db.query(
          "select * from public.ir_save_report($1,1,$2::jsonb,'human-authored',null)",
          [id, JSON.stringify({ ...content, ownership: invalid })],
        ),
      );
    await db.query(
      "select public.ir_set_invitation($1,'investor@example.test',true)",
      [company],
    );
    await actor(investor);
    await db.query("select public.ir_accept_invitation($1)", [company]);
    assert.equal(
      (await db.query("select * from public.report_versions")).rows.length,
      0,
    );
    await assert.rejects(
      db.query(
        "select * from public.ir_save_report($1,1,$2::jsonb,'human-authored',null)",
        [id, JSON.stringify(content)],
      ),
      /Admin/,
    );
    await actor(admin);
    const saved = (
      await db.query<{
        revision: number;
        content: typeof content;
        state: string;
      }>(
        "select * from public.ir_save_report($1,1,$2::jsonb,'human-authored',null)",
        [id, JSON.stringify(content)],
      )
    ).rows[0];
    assert.equal(saved.revision, 2);
    assert.deepEqual(saved.content.ownership, ownership);
    await assert.rejects(
      db.query(
        "select * from public.ir_save_report($1,1,$2::jsonb,'human-authored',null)",
        [id, JSON.stringify(content)],
      ),
      /revision/i,
    );
    await db.query("select * from public.ir_transition_report($1,2,'review')", [
      id,
    ]);
    await db.query(
      "select * from public.ir_transition_report($1,3,'approve')",
      [id],
    );
    content.ownership!.sourceLabel = "Mockの訂正済み名簿";
    const changed = (
      await db.query<{
        revision: number;
        state: string;
        approved_hash: string | null;
      }>(
        "select * from public.ir_save_report($1,4,$2::jsonb,'human-authored',null)",
        [id, JSON.stringify(content)],
      )
    ).rows[0];
    assert.equal(changed.state, "draft");
    assert.equal(changed.approved_hash, null);
    await db.query("select * from public.ir_transition_report($1,5,'review')", [
      id,
    ]);
    await db.query(
      "select * from public.ir_transition_report($1,6,'approve')",
      [id],
    );
    await db.query(
      "select * from public.ir_transition_report($1,7,'publish')",
      [id],
    );
    await actor(investor);
    assert.deepEqual(
      (
        await db.query<{ content: typeof content }>(
          "select content from public.report_versions",
        )
      ).rows[0].content.ownership,
      content.ownership,
    );
    await actor(other);
    assert.equal(
      (await db.query("select * from public.report_versions")).rows.length,
      0,
    );
    await actor(admin);
    await assert.rejects(
      db.query(
        "select * from public.ir_save_report($1,8,$2::jsonb,'human-authored',null)",
        [id, JSON.stringify(content)],
      ),
      /immutable/i,
    );
  } finally {
    await db.close();
  }
});
