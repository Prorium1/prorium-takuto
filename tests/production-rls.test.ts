import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { emptyReport, structureMonthlyNotes } from "../src/lib/domain/monthly";

test("confirmed admins can manage with an email session while grants and snapshots stay protected", async () => {
  const db = new PGlite();
  const company = "11111111-1111-1111-1111-111111111111",
    admin = "22222222-2222-2222-2222-222222222222",
    investor = "33333333-3333-3333-3333-333333333333",
    stranger = "44444444-4444-4444-4444-444444444444";
  const actor = async (id: string, aal = "aal2") =>
    db.exec(
      `reset role; set role authenticated; select set_config('request.jwt.claim.sub','${id}',false); select set_config('request.jwt.claims','{"aal":"${aal}"}',false);`,
    );
  try {
    await db.exec(`create role anon; create role authenticated; create role service_role bypassrls; create schema auth; create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz); create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$; create function auth.jwt() returns jsonb language sql stable as $$ select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb $$; grant usage on schema auth to authenticated,service_role; grant execute on function auth.uid(),auth.jwt() to authenticated,service_role;
 create schema storage; create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]); create table storage.objects(id uuid default gen_random_uuid(),bucket_id text,name text,metadata jsonb default '{}'); alter table storage.objects enable row level security; grant usage on schema storage to authenticated; grant select,insert,update,delete on storage.objects to authenticated;`);
    await db.exec(await readFile("database/schema.sql", "utf8"));
    await db.exec(await readFile("database/production.sql", "utf8"));
    await db.exec(await readFile("supabase/migrations/20261010025059_email_only_admin_access.sql", "utf8"));
    await db.exec(await readFile("supabase/migrations/20261009031730_briefing_stories.sql", "utf8"));
    await db.exec(await readFile("supabase/migrations/20261009012909_freee_connection.sql", "utf8"));
    await db.exec(await readFile("supabase/migrations/20261009021638_freee_staging.sql", "utf8"));
    await db.exec(
      `insert into auth.users values ('${admin}','owner@example.test',now()),('${investor}','investor@example.test',now()),('${stranger}','stranger@example.test',now()); insert into public.companies(id,name) values ('${company}','Prorium'); insert into private.admin_memberships(user_id,company_id) values ('${admin}','${company}');`,
    );
    const initial = emptyReport("2026-10", company).content;
    await actor(admin, "aal1");
    await db.query("select public.ir_save_freee_connection($1,11486508,$2,now()+interval '1 hour')", [company, "a".repeat(60)]);
    const identity = await db.query<{ value: { role: string; needsMfa: boolean } }>(
      `select public.ir_current_actor($1) as value`,
      [company],
    );
    assert.equal(identity.rows[0].value.role, "admin");
    assert.equal(identity.rows[0].value.needsMfa, false);
    await db.exec(`reset role; update auth.users set email_confirmed_at=null where id='${admin}';`);
    await actor(admin, "aal1");
    const unconfirmed = await db.query<{ value: unknown }>(
      "select public.ir_current_actor($1) as value",
      [company],
    );
    assert.equal(unconfirmed.rows[0].value, null);
    await assert.rejects(
      db.query("select public.ir_freee_connection_status($1)", [company]),
      /Admin/i,
    );
    await db.exec(`reset role; update auth.users set email_confirmed_at=now() where id='${admin}';`);
    await actor(admin);
    await db.query("select public.ir_save_freee_connection($1,11486508,$2,now()+interval '1 hour')", [company, "a".repeat(60)]);
    const freeeStatus = await db.query<{ status: { connected: boolean } }>("select public.ir_freee_connection_status($1) as status", [company]);
    assert.equal(freeeStatus.rows[0].status.connected, true);
    await actor(investor, "aal1");
    await assert.rejects(db.query("select public.ir_freee_connection_status($1)", [company]), /MFA|Admin/i);
    await assert.rejects(db.query("select * from private.freee_connections"), /permission denied/i);
    await assert.rejects(db.query("select * from private.freee_staged_financials"), /permission denied/i);
    await assert.rejects(db.query("select * from public.ir_list_freee_staged($1)", [company]), /MFA|Admin/i);
    await actor(admin);
    const staged = await db.query("select * from public.ir_list_freee_staged($1)", [company]);
    assert.equal(staged.rows.length, 0);
    const malformed = emptyReport("2026-09", company).content;
    delete malformed.financial.available;
    await assert.rejects(
      db.query(`select * from public.ir_create_report($1,$2,$3::jsonb)`, [
        company,
        "2026-09",
        JSON.stringify(malformed),
      ]),
      /provenance/i,
    );
    for (const invalid of [
      {
        ...emptyReport("2026-09", company).content,
        summary: { ...initial.summary, points: null },
      },
      { ...emptyReport("2026-09", company).content, forward: {} },
      {
        ...emptyReport("2026-09", company).content,
        ai: { ...initial.ai, revenue: null },
      },
    ]) {
      await assert.rejects(
        db.query(`select * from public.ir_create_report($1,$2,$3::jsonb)`, [
          company,
          "2026-09",
          JSON.stringify(invalid),
        ]),
        /Invalid|sections/i,
      );
    }
    const created = await db.query<{ id: string; revision: number }>(
      `select * from public.ir_create_report($1,$2,$3::jsonb)`,
      [company, "2026-10", JSON.stringify(initial)],
    );
    const id = created.rows[0].id;
    assert.ok(id);
    await assert.rejects(
      db.query(
        `update public.report_versions set content=content where id=$1`,
        [id],
      ),
      /permission denied/i,
    );
    await db.query(`select public.ir_set_invitation($1,$2,true)`, [
      company,
      "investor@example.test",
    ]);
    await actor(investor, "aal1");
    await db.query(`select public.ir_accept_invitation($1)`, [company]);
    assert.equal(
      (await db.query("select * from public.report_versions")).rows.length,
      0,
    );
    await assert.rejects(
      db.query(`select * from public.ir_transition_report($1,1,'review')`, [
        id,
      ]),
      /Admin|MFA/i,
    );
    await actor(admin);
    const content = {
      ...initial,
      summary: structureMonthlyNotes(
        "2026-10",
        "新しい講座を開講しました。\n来月は運営の改善を続けます。",
      ),
      ceo: {
        ...initial.ceo,
        message: "株主の皆さまへ月次の進捗を報告します。",
      },
    };
    await db.query(
      `select * from public.ir_save_report($1,1,$2::jsonb,'generated-ai',$3)`,
      [id, JSON.stringify(content), "PRIVATE OWNER NOTES"],
    );
    await assert.rejects(
      db.query(
        `select * from public.ir_save_report($1,1,$2::jsonb,'human-authored',null)`,
        [id, JSON.stringify(content)],
      ),
      /concurrent|revision/i,
    );
    const doc = await db.query<{ id: string; storage_path: string }>(
      `select * from public.ir_reserve_document($1,2,$2::jsonb)`,
      [
        id,
        JSON.stringify({
          title: "損益計算書",
          category: "pl",
          period: "2026-10",
          basis: "monthly",
          description: "10月単月",
          fileName: "pl.pdf",
          bytes: 128,
          checksum: "a".repeat(64),
        }),
      ],
    );
    const d = doc.rows[0];
    await db.query(
      `insert into storage.objects(bucket_id,name) values ('ir-financial-documents',$1)`,
      [d.storage_path],
    );
    await actor(investor, "aal1");
    assert.equal(
      (await db.query("select * from public.ir_documents")).rows.length,
      0,
    );
    assert.equal(
      (await db.query("select * from storage.objects")).rows.length,
      0,
    );
    await assert.rejects(
      db.query(`select public.ir_record_document_download($1)`, [d.id]),
      /Authorization/i,
    );
    await actor(admin);
    await db.query(`select * from public.ir_attach_document($1,2,$2)`, [
      id,
      d.id,
    ]);
    await db.query(`select * from public.ir_transition_report($1,3,'review')`, [
      id,
    ]);
    await db.query(
      `select * from public.ir_transition_report($1,4,'approve')`,
      [id],
    );
    await db.query(
      `select * from public.ir_transition_report($1,5,'publish')`,
      [id],
    );
    await actor(investor, "aal1");
    assert.equal(
      (await db.query("select * from public.report_versions")).rows.length,
      1,
    );
    assert.equal(
      (await db.query("select * from public.monthly_inputs")).rows.length,
      0,
    );
    assert.equal(
      (await db.query("select * from public.ir_documents")).rows.length,
      1,
    );
    assert.equal(
      (await db.query("select * from storage.objects")).rows.length,
      1,
    );
    await db.query(`select public.ir_record_document_download($1)`, [d.id]);
    await assert.rejects(
      db.query(`select * from public.ir_reserve_document($1,6,$2::jsonb)`, [
        id,
        "{}",
      ]),
      /Admin|MFA/i,
    );
    await actor(stranger);
    assert.equal(
      (await db.query("select * from storage.objects")).rows.length,
      0,
    );
    assert.equal(
      (await db.query("select * from public.ir_documents")).rows.length,
      0,
    );
    await actor(admin);
    await assert.rejects(
      db.query(
        `select * from public.ir_save_report($1,6,$2::jsonb,'human-authored',null)`,
        [id, JSON.stringify(content)],
      ),
      /immutable|published/i,
    );
    const rev = await db.query<{ id: string }>(
      `select * from public.ir_revise_report($1,'minor')`,
      [id],
    );
    assert.ok(rev.rows[0].id !== id);
    await db.exec(
      `reset role; update auth.users set email='changed-investor@example.test' where id='${investor}';`,
    );
    await actor(admin);
    await db.query(`select public.ir_set_invitation($1,$2,false)`, [
      company,
      "investor@example.test",
    ]);
    await actor(investor, "aal1");
    const actorAfterEmailChange = (
      await db.query<{ actor: unknown }>(
        "select public.ir_current_actor($1) as actor",
        [company],
      )
    ).rows[0].actor;
    // Emulate the grant write from an acceptance that raced with revocation.
    await db.exec(
      `reset role; update public.investor_grants set revoked_at=null where user_id='${investor}' and company_id='${company}';`,
    );
    await actor(investor, "aal1");
    const actorAfterRacedGrant = (
      await db.query<{ actor: unknown }>(
        "select public.ir_current_actor($1) as actor",
        [company],
      )
    ).rows[0].actor;
    assert.deepEqual(
      [actorAfterEmailChange, actorAfterRacedGrant],
      [null, null],
      "Revocation must survive both Auth email changes and raced acceptance writes",
    );
    assert.equal(
      (await db.query("select * from storage.objects")).rows.length,
      0,
    );
    assert.equal(
      (await db.query("select * from public.report_versions")).rows.length,
      0,
    );
    await actor(admin);
    assert.equal(
      (
        await db.query<{ analysis: string }>(
          "select analysis from public.report_versions where id=$1",
          [id],
        )
      ).rows[0].analysis,
      "generated-ai",
    );
    await db.exec("reset role; set role anon;");
    await assert.rejects(
      db.query(`select public.ir_current_actor($1)`, [company]),
      /permission denied/i,
    );
  } finally {
    await db.close();
  }
});
