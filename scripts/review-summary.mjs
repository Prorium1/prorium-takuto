// Mock-only local visual and accessibility inspection.
import { chromium } from "playwright-core";
import { mkdir, writeFile } from "node:fs/promises";
import assert from "node:assert/strict";

const origin = process.env.PREVIEW_ORIGIN || "http://127.0.0.1:3300";
const output = "artifacts/summary-review";
await mkdir(output, { recursive: true });
const browser = await chromium.launch({
  executablePath: "/usr/bin/chromium",
  args: ["--no-sandbox", "--disable-dev-shm-usage"],
});
const page = await browser.newPage({
  viewport: { width: 1440, height: 1100 },
  reducedMotion: "reduce",
});
const errors = [];
const results = [];
page.on("pageerror", (error) => errors.push(error.message));
async function inspect(name, width) {
  await page.setViewportSize({ width, height: 1100 });
  await page.evaluate(() => document.fonts.ready);
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > innerWidth,
  );
  let violations = null;
  if (process.env.AXE_SCRIPT) {
    await page.addScriptTag({ path: process.env.AXE_SCRIPT });
    violations = await page.evaluate(async () =>
      (
        await window.axe.run(document, {
          runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21aa"] },
        })
      ).violations.map((v) => ({
        id: v.id,
        nodes: v.nodes.map((n) => ({
          target: n.target,
          summary: n.failureSummary,
        })),
      })),
    );
  }
  await page.screenshot({ path: `${output}/${name}.png`, fullPage: true });
  results.push({ name, width, overflow, violations });
  console.log(JSON.stringify({ name, width, overflow, violations }));
}
try {
  await page.goto(`${origin}/login`);
  await page.getByRole("button", { name: "株主としてデモを見る" }).click();
  await page.waitForURL("**/reports/2026-08");
  for (const width of [1440, 768, 375, 320]) {
    await inspect(`report-${width}`, width);
    if (width === 1440 || width === 375)
      await page
        .locator("#summary")
        .screenshot({ path: `${output}/summary-${width}.png` });
  }
  await page
    .getByRole("navigation", { name: "サマリーから詳しく読む" })
    .getByRole("link", { name: "AIの売上・効率への寄与" })
    .click();
  assert.ok(page.url().endsWith("#ai"));
  await page.setViewportSize({ width: 1440, height: 1100 });
  const pdf = await page.request.get(`${origin}/api/reports/2026-08/pdf`);
  assert.equal(pdf.status(), 200, "Mock report PDF export failed");
  await writeFile(`${output}/Prorium-2026-08.pdf`, await pdf.body());
  await page.getByRole("button", { name: "ログアウト" }).click();
  await page.waitForURL("**/login");
  await page.getByRole("button", { name: "管理者デモを開く" }).click();
  await page.waitForURL("**/admin");
  await page.goto(`${origin}/admin/reports/report-2026-09-v1-0`);
  await page
    .getByLabel("今月あったこと", { exact: true })
    .fill("【架空の振り返り】既存顧客向けサービスの運営手順を見直しました。");
  await page
    .getByLabel("課題と、取っている対策", { exact: true })
    .fill(
      "担当者への業務集中が課題です。手順書を共有し、来月の対応時間を確認します。",
    );
  await inspect("admin-1440", 1440);
  await page
    .locator(".summary-review")
    .screenshot({ path: `${output}/editor-guide.png` });
  await inspect("admin-375", 375);
  await page
    .locator(".monthly-input")
    .screenshot({ path: `${output}/reflection-375.png` });
  await writeFile(
    `${output}/results.json`,
    JSON.stringify({ results, errors }, null, 2),
  );
  assert.equal(errors.length, 0, JSON.stringify(errors));
  assert.ok(
    results.every((r) => !r.overflow && !r.violations?.length),
    "Layout or accessibility failures",
  );
} finally {
  await browser.close();
}
