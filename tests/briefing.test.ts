import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { emptyReport } from "../src/lib/domain/monthly";
import { contentEditSchema } from "../src/lib/domain/validation";
import type { BriefingStory } from "../src/lib/domain/types";

test("investor briefing accepts categorized source text and rejects unclassified or unexpected content", async () => {
  const story = {
    id: "11111111-1111-4111-8111-111111111111",
    topic: "development",
    kind: "Actual",
    title: "Synthetic release",
    body: "Synthetic example of a validated release.",
  };
  assert.equal(contentEditSchema.shape.briefing.parse([story]).length, 1);
  assert.throws(() =>
    contentEditSchema.shape.briefing.parse([{ ...story, kind: "Maybe" }]),
  );
  const db = new PGlite();
  try {
    await db.exec(
      `create role anon; create role authenticated; create role service_role bypassrls; create schema auth; create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz); create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$; create function auth.jwt() returns jsonb language sql stable as $$ select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb $$; grant usage on schema auth to authenticated,service_role; grant execute on function auth.uid(),auth.jwt() to authenticated,service_role; create schema storage; create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]); create table storage.objects(id uuid default gen_random_uuid(),bucket_id text,name text,metadata jsonb default '{}');`,
    );
    await db.exec(await readFile("database/schema.sql", "utf8"));
    await db.exec(await readFile("database/production.sql", "utf8"));
    await db.exec(
      await readFile(
        "supabase/migrations/20261009030000_briefing_stories.sql",
        "utf8",
      ),
    );
    const content = emptyReport(
      "2026-08",
      "22222222-2222-4222-8222-222222222222",
    ).content;
    content.briefing = [story as BriefingStory];
    await db.query("select private.validate_content($1::jsonb)", [
      JSON.stringify(content),
    ]);
    await assert.rejects(
      db.query("select private.validate_content($1::jsonb)", [
        JSON.stringify({
          ...content,
          briefing: [{ ...story, kind: "Unverified" }],
        }),
      ]),
      /Invalid briefing item/,
    );
    await assert.rejects(
      db.query("select private.validate_content($1::jsonb)", [
        JSON.stringify({
          ...content,
          briefing: [{ ...story, unexpected: "text" }],
        }),
      ]),
      /Invalid text fields/,
    );
  } finally {
    await db.close();
  }
});
