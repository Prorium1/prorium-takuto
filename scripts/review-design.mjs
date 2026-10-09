// Local visual review. Uses only the development mock portal.
// Optional: AXE_SCRIPT=/path/to/axe.min.js node scripts/review-design.mjs
import { chromium } from "playwright-core";
import { mkdir, writeFile } from "node:fs/promises";
const origin = process.env.PREVIEW_ORIGIN || "http://127.0.0.1:3000";
const output = process.env.DESIGN_REVIEW_OUTPUT || "artifacts/design-review";
const browser = await chromium.launch({
  executablePath: "/usr/bin/chromium",
  args: ["--no-sandbox", "--disable-dev-shm-usage"],
});
const page = await browser.newPage({
  viewport: { width: 1440, height: 1000 },
  reducedMotion: "reduce",
});
const results = [];
const errors = [];
page.on("pageerror", (error) => errors.push(error.message));
await mkdir(output, { recursive: true });
async function inspect(name, width, fullPage = false) {
  await page.setViewportSize({ width, height: width < 700 ? 900 : 1000 });
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: `${output}/${name}.png`, fullPage });
  const layout = await page.evaluate(() => ({
    overflow: document.documentElement.scrollWidth > innerWidth,
    title: document.title,
    firstSummaryY: document
      .querySelector("#summary h2")
      ?.getBoundingClientRect().top,
  }));
  let violations = [];
  if (process.env.AXE_SCRIPT) {
    await page.addScriptTag({ path: process.env.AXE_SCRIPT });
    violations = await page.evaluate(async () => {
      const result = await window.axe.run(document, {
        runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21aa"] },
      });
      return result.violations.map((v) => ({
        id: v.id,
        impact: v.impact,
        description: v.description,
        nodes: v.nodes.map((n) => ({
          target: n.target,
          summary: n.failureSummary,
        })),
      }));
    });
  }
  results.push({
    name,
    width,
    ...layout,
    accessibilityChecked: !!process.env.AXE_SCRIPT,
    violations,
  });
  console.log(
    JSON.stringify({
      name,
      width,
      ...layout,
      violations: violations.map((v) => ({ id: v.id, count: v.nodes.length })),
    }),
  );
}
try {
  await page.goto(`${origin}/login`);
  await inspect("login-desktop", 1440, true);
  await inspect("login-mobile", 375, true);
  await page.getByRole("button", { name: "株主としてデモを見る" }).click();
  await page.waitForURL("**/reports/2026-08");
  for (const [name, width] of [
    ["report-desktop", 1440],
    ["report-tablet", 768],
    ["report-mobile", 375],
    ["report-small", 320],
  ]) {
    await page.evaluate(() => scrollTo(0, 0));
    await inspect(name, width);
  }
  await page.setViewportSize({ width: 1440, height: 1000 });
  for (const id of [
    "performance",
    "drivers",
    "business",
    "ai",
    "position",
    "forward",
    "risks",
    "ceo",
  ]) {
    await page
      .locator(`#${id}`)
      .screenshot({ path: `${output}/section-${id}.png` });
  }
  await page.goto(`${origin}/reports`);
  await inspect("archive-desktop", 1440, true);
  await inspect("archive-mobile", 375, true);
  await writeFile(
    `${output}/review.json`,
    JSON.stringify({ results, errors }, null, 2),
  );
  if (results.some((r) => r.overflow || r.violations.length) || errors.length)
    process.exitCode = 1;
} finally {
  await browser.close();
}
