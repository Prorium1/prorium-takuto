import assert from "node:assert/strict";
import { spawn } from "node:child_process";

// Smoke-test the production fail-closed boundary using only loopback requests.
const origin = "http://127.0.0.1:3200";
const child = spawn(
  process.execPath,
  [
    "node_modules/next/dist/bin/next",
    "start",
    "--port",
    "3200",
    "--hostname",
    "127.0.0.1",
  ],
  {
    stdio: ["ignore", "pipe", "pipe"],
    env: {
      ...process.env,
      NODE_ENV: "production",
      PRORIUM_ENV: "production",
      NEXT_DIST_DIR: process.env.NEXT_DIST_DIR || ".next/build",
    },
  },
);
let output = "";
child.stdout.on("data", (data) => {
  output += data;
});
child.stderr.on("data", (data) => {
  output += data;
});
try {
  let ready = false;
  let lastFailure = "";
  for (let attempt = 0; attempt < 10; attempt++) {
    if (child.exitCode !== null) throw new Error(output);
    try {
      const response = await fetch(`${origin}/login`, {
        signal: AbortSignal.timeout(5_000),
      });
      if (response.ok) {
        ready = true;
        break;
      }
      lastFailure = `HTTP ${response.status}: ${await response.text()}`;
    } catch (error) {
      lastFailure = String(error);
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  assert.ok(ready, `${output}\n${lastFailure}`);
  const login = await fetch(`${origin}/login`);
  const html = await login.text();
  assert.ok(html.includes("本番認証は未接続です"));
  assert.ok(!html.includes("株主としてデモを見る"));
  assert.ok(login.headers.get("cache-control")?.includes("no-store"));
  for (const route of [
    "/dashboard",
    "/reports",
    "/reports/2026-08",
    "/admin",
  ]) {
    const response = await fetch(`${origin}${route}`, { redirect: "manual" });
    assert.equal(response.status, 307, route);
    assert.equal(
      new URL(response.headers.get("location"), origin).pathname,
      "/login",
    );
  }
  const pdf = await fetch(`${origin}/api/reports/2026-08/pdf`, {
    headers: { Cookie: "prorium_mock_session=tampered" },
  });
  assert.equal(pdf.status, 401);
  console.log(
    "PASS: production disables demo login, redirects protected routes, and denies PDF access.",
  );
} finally {
  child.kill("SIGTERM");
}
