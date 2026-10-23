import { test, expect } from "@playwright/test";
test("owner can compare fiscal trends and change a reference scenario without changing actuals; investor is denied", async ({
  page,
  browser,
}) => {
  await page.goto("/login");
  await page.getByRole("button", { name: "管理者デモを開く" }).click();
  await page.waitForURL("**/admin");
  await page.goto("/admin/fiscal/2026");
  await expect(
    page.getByRole("heading", { name: /今期の現在地と、\s*着地への道筋。/ }),
  ).toBeVisible();
  await expect(page.locator(".fiscal-goal > strong")).toHaveText(
    "600,000,000円",
  );
  await expect(
    page.getByRole("heading", { name: "今期の経営サマリー" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "業務効率化と新規展開" }),
  ).toBeVisible();
  const actual = await page
    .locator(".fiscal-kpis")
    .evaluate((e) => e.textContent || "");
  const revenue = page.getByLabel("実績未取得分の月平均売上（円）");
  await revenue.fill("50000000");
  await expect(page.locator(".fiscal-reference")).toContainText(
    "484,500,000円",
  );
  await expect(page.locator(".fiscal-kpis")).toHaveText(actual);
  await page
    .getByRole("group", { name: "表示する通期指標" })
    .getByRole("button", { name: "営業利益", exact: true })
    .click();
  await expect(
    page.getByRole("img", { name: "営業利益の12か月単月推移" }),
  ).toBeVisible();
  await revenue.fill("");
  await expect(
    page.getByRole("alert").filter({ hasText: "空欄を0円とは扱いません" }),
  ).toBeVisible();
  await expect(page.locator(".fiscal-reference")).toContainText("入力を確認");
  await page.getByRole("button", { name: "直近平均に戻す" }).click();
  await expect(
    page.getByRole("alert").filter({ hasText: "空欄を0円とは扱いません" }),
  ).toHaveCount(0);
  await page
    .getByRole("group", { name: "表示するB/S指標" })
    .getByRole("button", { name: "純資産", exact: true })
    .click();
  await page.getByText("PL・BSの月次一覧と取得日時を開く").click();
  await expect(
    page.getByRole("cell", { name: "未締め", exact: true }).first(),
  ).toBeVisible();
  await page.screenshot({
    path: "/tmp/prorium-fiscal-desktop.png",
    fullPage: true,
  });
  await page.evaluate(() => scrollTo(0, 0));
  await page.screenshot({ path: "/tmp/prorium-fiscal-desktop-fold.png" });
  await page.setViewportSize({ width: 375, height: 900 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  expect(
    await page
      .locator(".fiscal-kpis strong")
      .first()
      .evaluate((el) => Number.parseFloat(getComputedStyle(el).fontSize)),
  ).toBeGreaterThanOrEqual(30);
  expect(
    await page
      .locator(".fiscal-kpis strong")
      .first()
      .evaluate((el) => Number.parseFloat(getComputedStyle(el).fontWeight)),
  ).toBeGreaterThanOrEqual(700);
  await expect(page.locator(".fiscal-kpis")).toContainText("434,500,000円");
  await page.screenshot({
    path: "/tmp/prorium-fiscal-mobile.png",
    fullPage: true,
  });
  await page.evaluate(() => scrollTo(0, 0));
  await page.screenshot({ path: "/tmp/prorium-fiscal-mobile-fold.png" });
  const investor = await browser.newContext();
  try {
    const other = await investor.newPage();
    await other.goto("/login");
    await other.getByRole("button", { name: "株主としてデモを見る" }).click();
    await other.waitForURL("**/dashboard");
    expect((await other.goto("/admin/fiscal/2026"))?.status()).toBe(404);
  } finally {
    await investor.close();
  }
});
