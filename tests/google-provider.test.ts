import test from "node:test";
import assert from "node:assert/strict";
import { googleProviderEnabled } from "../src/lib/domain/google-provider";

const config = {
  url: "https://example.supabase.co",
  key: "sb_publishable_test",
};

test("Google login is shown only when Supabase reports the provider enabled", async () => {
  const enabled = await googleProviderEnabled(config, async () =>
    Response.json({ external: { google: true } }),
  );
  const disabled = await googleProviderEnabled(config, async () =>
    Response.json({ external: { google: false } }),
  );
  assert.equal(enabled, true);
  assert.equal(disabled, false);
});

test("Google login stays hidden when provider settings cannot be read", async () => {
  assert.equal(
    await googleProviderEnabled(config, async () => new Response(null, { status: 503 })),
    false,
  );
});
