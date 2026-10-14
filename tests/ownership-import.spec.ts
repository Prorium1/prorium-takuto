import { test, expect } from "@playwright/test";

test("an imported registry prefills a private draft and needs fresh confirmation after edits", async ({
  page,
  browser,
}) => {
  await page.goto("/login");
  await page.getByRole("button", { name: "管理者デモを開く" }).click();
  await page.waitForURL("**/admin");
  await page.goto("/admin/reports");
  await page.getByLabel("対象月").fill("2027-01");
  await page.getByLabel("文章とPDFで開始する").check();
  await page
    .getByRole("button", { name: "レポートを作成", exact: true })
    .click();
  await page.waitForURL(/\/admin\/reports\/[a-f0-9-]+$/);
  const id = page.url().split("/").pop()!;
  await page.goto(`/admin/shareholders?report=${id}`);
  await expect(page.locator(".ownership-source-import")).toContainText(
    "Mockの取得サンプル · 未接続",
  );
  await expect(page.getByLabel("発行済株式数", { exact: true })).toHaveValue(
    "1000",
  );
  await expect(page.getByLabel("公開する氏名・法人名").first()).toHaveValue(
    "Mock 創業株主A",
  );
  await expect(
    page.getByRole("link", { name: "レポートの内容確認・承認・公開へ進む" }),
  ).toHaveCount(0);
  const confirmation = page.getByLabel("元資料と数値を照合し", {
    exact: false,
  });
  await expect(confirmation).not.toBeChecked();
  await confirmation.check();
  await page.getByLabel("元資料の名称").fill("PRIVATE-IMPORTED-MOCK-CANARY");
  await expect(confirmation).not.toBeChecked();
  await page.setViewportSize({ width: 320, height: 900 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await confirmation.check();
  await page.getByRole("button", { name: "株主構成を下書きに保存" }).click();
  await expect(page.getByRole("status")).toContainText("非公開の下書きに保存");
  await page.reload();
  await expect(page.getByLabel("元資料の名称")).toHaveValue(
    "PRIVATE-IMPORTED-MOCK-CANARY",
  );
  await confirmation.check();
  await page.getByRole("button", { name: "取得した名簿を読み込む" }).click();
  await expect(confirmation).not.toBeChecked();
  await expect(page.getByLabel("元資料の名称")).toHaveValue(
    "smartround形式の架空サンプル（未接続）",
  );
  await expect(
    page.getByRole("link", { name: "レポートの内容確認・承認・公開へ進む" }),
  ).toHaveCount(0);
  const investor = await browser.newContext();
  try {
    const other = await investor.newPage();
    await other.goto("/login");
    await other.getByRole("button", { name: "株主としてデモを見る" }).click();
    await other.waitForURL(/\/dashboard$/);
    const response = await other.goto("/shareholders");
    expect(
      (await response!.text()).includes("PRIVATE-IMPORTED-MOCK-CANARY"),
    ).toBe(false);
    expect(
      (await other.goto(`/admin/shareholders?report=${id}`))?.status(),
    ).toBe(404);
  } finally {
    await investor.close();
  }
});
