import { test, expect, type Page } from "@playwright/test";

async function signIn(page: Page, role: "investor" | "admin") {
  await page.goto("/login");
  await page
    .getByRole("button", {
      name: role === "admin" ? "管理者デモを開く" : "株主としてデモを見る",
    })
    .click();
  await page.waitForURL(role === "admin" ? "**/admin" : /\/dashboard$/);
}

test("shareholder portal makes its three purposes clear and names stay readable on mobile", async ({
  page,
}) => {
  await signIn(page, "investor");
  await expect(
    page.getByRole("heading", { name: "株主ポータル", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".portal-entries > a")).toHaveCount(3);
  await expect(page.locator(".portal-admin-panel")).toHaveCount(0);
  for (const width of [1440, 768, 390, 320]) {
    await page.setViewportSize({ width, height: 900 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    if (width <= 390)
      expect(
        await page
          .locator(".kpi-card")
          .first()
          .evaluate((element) => element.getBoundingClientRect().top),
      ).toBeLessThan(900);
  }
  await page.goto("/shareholders");
  await expect(page.locator(".ownership-table")).toContainText(
    "Mock 創業株主A",
  );
  await expect(page.locator(".ownership-table")).toContainText("55.00%");
  await expect(page.locator(".ownership-table")).toContainText("550株");
  await expect(page.locator(".ownership-basis")).toContainText(
    "Mockの確認用名簿",
  );
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  expect((await page.goto("/admin/shareholders"))?.status()).toBe(404);
});

test("ownership preview checks totals and saves a private named snapshot without publishing", async ({
  page,
  browser,
}) => {
  await signIn(page, "admin");
  await page.goto("/dashboard");
  await expect(page.locator(".portal-admin-panel")).toContainText(
    "管理者だけに表示",
  );
  await page.goto("/admin/shareholders?report=report-2026-09-v1-0");
  await page.getByRole("button", { name: "架空のサンプルを入れる" }).click();
  const save = page.getByRole("button", { name: "株主構成を下書きに保存" });
  await page.getByLabel("発行済株式数", { exact: true }).fill("1001");
  await expect(save).toBeDisabled();
  await expect(page.locator(".ownership-total")).toContainText("合計を一致");
  await page.getByLabel("発行済株式数", { exact: true }).fill("1000");
  await page
    .getByLabel("公開する氏名・法人名")
    .first()
    .fill("PRIVATE-DRAFT-MOCK-CANARY");
  await expect(page.locator(".ownership-form-preview")).toContainText(
    "PRIVATE-DRAFT-MOCK-CANARY",
  );
  await expect(
    page.getByRole("link", { name: "レポートの内容確認・承認・公開へ進む" }),
  ).toHaveCount(0);
  const dialog = page.waitForEvent("dialog");
  const navigation = page.getByRole("link", { name: "← 株主ポータル" }).click();
  await (await dialog).dismiss();
  await navigation;
  await expect(page).toHaveURL(/\/admin\/shareholders/);
  await page.getByLabel("元資料と数値を照合し", { exact: false }).check();
  await save.click();
  await expect(page.getByRole("status")).toContainText("非公開の下書きに保存");
  const investorContext = await browser.newContext();
  try {
    const investor = await investorContext.newPage();
    await signIn(investor, "investor");
    await investor.goto("/shareholders");
    await expect(investor.locator("main")).not.toContainText(
      "PRIVATE-DRAFT-MOCK-CANARY",
    );
    await expect(investor.locator(".ownership-table")).toContainText(
      "Mock 創業株主A",
    );
  } finally {
    await investorContext.close();
  }
  await page.reload();
  await expect(page.getByLabel("公開する氏名・法人名").first()).toHaveValue(
    "PRIVATE-DRAFT-MOCK-CANARY",
  );
  await page.getByLabel("株主への表示範囲").selectOption("grouped");
  await expect(page.locator(".ownership-form-preview")).not.toContainText(
    "PRIVATE-DRAFT-MOCK-CANARY",
  );
  await page.getByLabel("元資料と数値を照合し", { exact: false }).check();
  await save.click();
  await expect(page.getByRole("status")).toContainText("非公開の下書きに保存");
  await page.reload();
  await page.getByLabel("株主への表示範囲").selectOption("named");
  await expect(page.getByLabel("公開する氏名・法人名").first()).toHaveValue("");
  await expect(save).toBeDisabled();
});
