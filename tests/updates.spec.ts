import { test, expect } from "@playwright/test";
import { mockStatementPdf } from "../src/lib/mock/pdf";

test("owner publishes a monthly narrative and private statements; investors can download only after publication", async ({
  page,
  browser,
}) => {
  await page.goto("/login");
  await page.getByRole("button", { name: "管理者デモを開く" }).click();
  await page.waitForURL("**/admin");
  await page.goto("/admin/reports");
  await page.getByLabel("対象月").fill("2026-11");
  await page.getByLabel("文章とPDFで開始する").check();
  await page
    .getByRole("button", { name: "レポートを作成", exact: true })
    .click();
  await page.waitForURL(/\/admin\/reports\/[a-f0-9-]+$/);
  const editorUrl = page.url();
  await page
    .getByLabel("今月あったこと")
    .fill(
      "非公開の検討メモ：架空の契約条件です。\n新しい講座を開講しました。\nAI動画制作の工程を改善しました。\n来月は受講者の継続率を確認します。",
    );
  await page
    .getByRole("button", { name: "文章からサマリーの下書きを作成" })
    .click();
  await expect(
    page.getByText("入力した文章からサマリーの下書きを作成しました。", {
      exact: false,
    }),
  ).toBeVisible();
  await page.getByLabel("資料名", { exact: true }).fill("11月 損益計算書");
  await page.getByLabel("書類の種類", { exact: true }).selectOption("pl");
  await page.getByLabel("PDFファイル（4 MB以下）").setInputFiles({
    name: "Mock-PL.pdf",
    mimeType: "application/pdf",
    buffer: mockStatementPdf(),
  });
  await page.getByRole("button", { name: "PDFを添付する" }).click();
  await expect(
    page.getByText(
      "財務PDFを添付しました。承認・公開後に株主がダウンロードできます。",
    ),
  ).toBeVisible();
  const href = await page
    .getByRole("link", { name: "11月 損益計算書", exact: true })
    .getAttribute("href");
  expect(href).toMatch(/\/api\/documents\/[a-f0-9-]+/);
  const investor = await browser.newContext();
  const investorPage = await investor.newPage();
  await investorPage.goto("http://127.0.0.1:3100/login");
  await investorPage
    .getByRole("button", { name: "株主としてデモを見る" })
    .click();
  await investorPage.waitForURL(/\/reports\/2026-/);
  expect(
    (await investor.request.get(`http://127.0.0.1:3100${href}`)).status(),
  ).toBe(404);
  await page
    .getByLabel("Executive Summary 本文")
    .fill("新しい講座を開講しました。運営の改善を続けます。");
  await page
    .getByLabel("サマリーの要点（1行に1つ）")
    .fill("講座を開講しました。\n運営の品質を改善しました。");
  await page
    .getByLabel("今後の見通し（任意）")
    .fill("来月は受講者の継続率を確認します。");
  await page
    .getByLabel("CEO コメント", { exact: true })
    .fill(
      "講座の品質と受講者の継続率を確認しながら、次の成長に向けて取り組みます。",
    );
  await page.getByRole("button", { name: "変更を保存", exact: true }).click();
  await expect(page.getByText("保存しました。", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "レビューへ提出" }).click();
  await expect(
    page.getByRole("button", { name: "内容を確認して承認" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "内容を確認して承認" }).click();
  await expect(page.getByRole("button", { name: "株主へ公開" })).toBeVisible();
  await page.getByRole("button", { name: "株主へ公開" }).click();
  await expect(
    page.getByText("公開しました。株主画面で確認できます。"),
  ).toBeVisible();
  await investorPage.goto("http://127.0.0.1:3100/reports/2026-11");
  await expect(
    investorPage
      .getByText("新しい講座を開講しました。", { exact: false })
      .first(),
  ).toBeVisible();
  await expect(investorPage.locator(".kpi-grid")).toHaveCount(0);
  await expect(investorPage.locator(".monthly-report")).not.toContainText(
    "非公開の検討メモ",
  );
  await expect(investorPage.locator(".monthly-report")).toContainText(
    "運営の品質を改善しました。",
  );
  await expect(investorPage.locator(".monthly-report")).toContainText(
    "来月は受講者の継続率を確認します。",
  );
  await expect(investorPage.locator(".report-colophon")).toContainText(
    "Management authored. Human approved.",
  );
  await expect(
    investorPage.getByText("財務KPIは未入力です。", { exact: false }),
  ).toBeVisible();
  const pdf = await investor.request.get(`http://127.0.0.1:3100${href}`);
  expect(pdf.status()).toBe(200);
  expect((await pdf.body()).subarray(0, 5).toString()).toBe("%PDF-");
  expect(pdf.headers()["content-disposition"]).toContain("attachment");
  await investorPage.goto(
    "http://127.0.0.1:3100/documents?category=pl&period=2026-11",
  );
  await expect(
    investorPage.getByRole("heading", { name: "11月 損益計算書" }),
  ).toBeVisible();
  await investorPage.setViewportSize({ width: 375, height: 900 });
  expect(
    await investorPage.evaluate(
      () => document.documentElement.scrollWidth > innerWidth,
    ),
  ).toBe(false);
  await page.goto(editorUrl);
  await page.getByRole("button", { name: "改訂版を作成" }).click();
  await page.waitForURL(
    (url) =>
      url.href !== editorUrl && url.pathname.startsWith("/admin/reports/"),
  );
  await page.getByRole("button", { name: "添付から外す" }).click();
  await expect(
    page.getByRole("link", { name: "11月 損益計算書", exact: true }),
  ).toHaveCount(0);
  expect(
    (await investor.request.get(`http://127.0.0.1:3100${href}`)).status(),
  ).toBe(200);
  await investor.close();
});
