import test from "node:test";
import assert from "node:assert/strict";
import { prepareMonthlySummary } from "../src/lib/server/monthly";
import {
  emptyReflection,
  structureReflection,
} from "../src/lib/domain/reflection";
import { emptyReport } from "../src/lib/domain/monthly";

test("AI drafting sends only public reflection and snapshot facts, fails closed outside production", async (t) => {
  const configured = {
    NODE_ENV: "production",
    PRORIUM_ENV: "production",
    VERCEL_ENV: "production",
    SUPABASE_URL: "https://isolated-project.supabase.co",
    SUPABASE_PUBLISHABLE_KEY:
      "sb_publishable_example_for_configuration_validation",
    PRORIUM_COMPANY_ID: "11111111-1111-4111-8111-111111111111",
    APP_ORIGIN: "https://ir.prorium.example",
    OPENAI_API_KEY: "synthetic-test-key-never-sent-to-network",
  };
  const original = Object.fromEntries(
    Object.keys(configured).map((key) => [key, process.env[key]]),
  );
  const reflection = {
    ...emptyReflection(),
    events: "合成データで新しい講座の運営を検証しました。",
    privateNotes: "PRIVATE_CANARY_NEVER_TRANSMIT",
  };
  const financial = emptyReport("2026-10", "company").content.financial;
  const draft = structureReflection("2026-10", reflection);
  const fetch = t.mock.method(
    globalThis,
    "fetch",
    async (_url: string | URL | Request, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body));
      assert.equal(body.store, false);
      assert.ok(!String(init?.body).includes(reflection.privateNotes));
      assert.ok(!String(init?.body).includes("privateNotes"));
      assert.equal(JSON.parse(body.input).financial, null);
      return Response.json({
        output: [
          { content: [{ type: "output_text", text: JSON.stringify(draft) }] },
        ],
      });
    },
  );
  try {
    Object.assign(process.env, configured);
    const result = await prepareMonthlySummary(
      "2026-10",
      reflection,
      financial,
    );
    assert.equal(result.method, "openai");
    assert.equal(result.summary.text, draft.summary.text);
    assert.equal(fetch.mock.callCount(), 1);
    Object.assign(process.env, { NODE_ENV: "development" });
    await assert.rejects(
      prepareMonthlySummary("2026-10", reflection, financial),
      /本番接続/,
    );
    assert.equal(fetch.mock.callCount(), 1);
    Object.assign(process.env, { VERCEL_ENV: "preview", PRORIUM_ENV: "mock" });
    assert.equal(
      (await prepareMonthlySummary("2026-10", reflection, financial)).method,
      "editorial",
    );
    assert.equal(fetch.mock.callCount(), 1);
    Object.assign(process.env, configured);
    fetch.mock.mockImplementation(async () =>
      Response.json({
        output: [
          {
            content: [
              {
                type: "output_text",
                text: JSON.stringify({
                  ...draft,
                  summary: { ...draft.summary, text: "あ".repeat(401) },
                }),
              },
            ],
          },
        ],
      }),
    );
    await assert.rejects(
      prepareMonthlySummary("2026-10", reflection, financial),
      /所定の形式・文字数/,
    );
    fetch.mock.mockImplementation(
      async () =>
        new Response("provider details are not exposed", { status: 429 }),
    );
    await assert.rejects(
      prepareMonthlySummary("2026-10", reflection, financial),
      /AI生成に失敗/,
    );
  } finally {
    for (const [key, value] of Object.entries(original)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    fetch.mock.restore();
  }
});
