import { test, expect } from "@playwright/test";

test("login setup is restricted to administrators", async ({ page }) => {
  await page.goto("/admin/login");
  await expect(page).toHaveURL(/\/login$/);
  await page.getByRole("button", { name: "株主としてデモを見る" }).click();
  await page.waitForURL("**/dashboard");
  const response = await page.goto("/admin/login");
  expect(response?.status()).toBe(404);
  await expect(
    page.getByRole("heading", { name: "Googleで入れるようにする" }),
  ).toHaveCount(0);
});

test("owner setup clearly separates configuration from a completed Google login", async ({
  page,
}) => {
  await page.goto("/login");
  await page.getByRole("button", { name: "管理者デモを開く" }).click();
  await page.waitForURL("**/admin");
  await page
    .getByRole("link", { name: "Googleログインを設定・確認する →" })
    .click();
  await expect(
    page.getByRole("heading", { name: "Googleで入れるようにする" }),
  ).toBeVisible();
  await expect(page.getByLabel("Googleログインの設定状況")).toContainText(
    "ここは確認用の環境です",
  );
  await expect(
    page.getByRole("link", { name: "SupabaseのGoogle設定を開く ↗" }),
  ).toHaveAttribute(
    "href",
    "https://supabase.com/dashboard/project/_/auth/providers?provider=Google",
  );
  for (const width of [390, 320]) {
    await page.setViewportSize({ width, height: 844 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  }
  await expect(page.locator('input[name*="secret" i]')).toHaveCount(0);
});
