import { test, expect } from "@playwright/test";
test("manual demo login remains available and the admin can copy and dismiss a clearly marked credential sample", async ({
  page,
  context,
}) => {
  await page.goto("/login");
  await page
    .getByText("メールアドレス・パスワード入力も試す", { exact: true })
    .click();
  const password = page.getByRole("textbox", {
    name: "パスワード",
    exact: true,
  });
  await expect(page.locator('input[name="password"]')).toBeVisible();
  await page
    .getByRole("button", { name: "パスワードを表示", exact: true })
    .click();
  await expect(password).toBeVisible();
  await page.getByRole("button", { name: "管理者デモを開く" }).click();
  await page.waitForURL("**/admin");
  await page.goto("/admin/investors");
  await expect(
    page.getByRole("button", { name: "登録してパスワードを発行", exact: true }),
  ).toBeDisabled();
  await page
    .getByRole("button", { name: "発行後のサンプルを見る", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "確認用のログイン情報", exact: true }),
  ).toBeVisible();
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page
    .getByRole("button", { name: "案内文をコピー", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText(
    "案内文をコピーしました",
  );
  const text = await page.evaluate(() => navigator.clipboard.readText());
  expect(text).toContain("メールアドレス：investor@prorium.example");
  expect(text).toContain("パスワード：prorium-demo");
  expect(text).toContain("/login\n");
  for (const width of [390, 320]) {
    await page.setViewportSize({ width, height: 900 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  }
  expect(await page.evaluate(() => JSON.stringify(localStorage))).not.toContain(
    "prorium-demo",
  );
  await page
    .getByRole("button", { name: "ログイン情報を閉じる", exact: true })
    .click();
  await expect(
    page.getByRole("region", { name: "発行したログイン情報" }),
  ).toHaveCount(0);
});
