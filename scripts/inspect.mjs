import { chromium } from "playwright-core";
import { mkdir, writeFile } from "node:fs/promises";
const browser = await chromium.launch({
  executablePath: process.env.PDF_CHROMIUM_PATH || "/usr/bin/chromium",
  headless: true,
  args: ["--no-sandbox", "--disable-dev-shm-usage"],
});
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
await mkdir("test-results/screenshots", { recursive: true });
await mkdir("artifacts", { recursive: true });
const origin = process.env.PREVIEW_ORIGIN || "http://127.0.0.1:3000";
try {
  await page.goto(`${origin}/login`);
  await page.getByRole("button", { name: "株主としてデモを見る" }).click();
  await page.waitForURL("**/reports/2026-08");
  await page.evaluate(() => document.fonts.ready);
  for (const [name, width, height] of [
    ["desktop", 1440, 1000],
    ["tablet", 768, 1000],
    ["mobile", 375, 900],
  ]) {
    await page.setViewportSize({ width, height });
    await page.screenshot({
      path: `test-results/screenshots/${name}.png`,
      fullPage: true,
    });
    await page.screenshot({
      path: `artifacts/${name}-preview.png`,
    });
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth,
    );
    console.log(
      JSON.stringify({
        name,
        width,
        overflow,
        sections: await page.locator("section.report-section").count(),
      }),
    );
  }
  const pdf = await page.request.get(
    `${origin}/api/reports/2026-08/pdf?version=v1.0`,
    { timeout: 90_000 },
  );
  if (!pdf.ok()) throw new Error(`PDF export failed: ${pdf.status()}`);
  const bytes = await pdf.body();
  if (!bytes.subarray(0, 5).equals(Buffer.from("%PDF-")))
    throw new Error("Invalid PDF signature");
  await writeFile("artifacts/Prorium-2026-08-v1.0.pdf", bytes);
  console.log(JSON.stringify({ pdfBytes: bytes.length }));
  console.log(
    JSON.stringify({
      errors,
      title: await page.title(),
      overlay: await page.locator("[data-nextjs-dialog]").count(),
    }),
  );
} finally {
  await browser.close();
}
