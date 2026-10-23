import { test, expect } from "@playwright/test";
test("an owner can present a read-only monthly briefing with unknowns and an investor cannot open it", async ({
  page,
  browser,
}) => {
  await page.goto("/login");
  await page.getByRole("button", { name: "管理者デモを開く" }).click();
  await page.waitForURL("**/admin");
  await page.getByRole("link", { name: "説明用プレビューを開く" }).click();
  await page.waitForURL(/\/present$/);
  await expect(
    page.getByText("管理者専用 · 説明用プレビュー · 未公開", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "確認が必要な情報" }),
  ).toBeVisible();
  await expect(
    page.getByText("現預金の比較値は未取得", { exact: true }),
  ).toBeVisible();
  await page.setViewportSize({ width: 375, height: 900 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  const presentationUrl = page.url();
  await page.screenshot({path:"/tmp/prorium-presentation-mobile.png",fullPage:true});
  const investor = await browser.newContext();
  try {
    const other = await investor.newPage();
    await other.goto("/login");
    await other.getByRole("button", { name: "株主としてデモを見る" }).click();
    await other.waitForURL("**/dashboard");
    expect((await other.goto(presentationUrl))?.status()).toBe(404);
  } finally {
    await investor.close();
  }
});
