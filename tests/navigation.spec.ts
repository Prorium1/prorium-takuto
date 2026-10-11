import { test, expect } from "@playwright/test";

test("mobile navigation isolates focus, closes on Escape, and reflects the reading position", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize({ width: 375, height: 900 });
  await page.goto("/login");
  await page.getByRole("button", { name: "株主としてデモを見る" }).click();
  await page.waitForURL(/\/reports\/20\d{2}-\d{2}$/);
  await page.goto("/reports/2026-08");
  const trigger = page.getByRole("button", { name: "メニューを開く" });
  const firstSection = page.getByRole("link", {
    name: "01 Executive Summary",
    exact: true,
  });
  await expect(trigger).toHaveAttribute("aria-expanded", "false");
  await expect(firstSection).toHaveCount(0);
  const logo = page.locator(".mobile-brand img");
  await expect(logo).toHaveAttribute("alt", "Prorium");
  await expect(logo).toBeVisible();
  await expect
    .poll(() => logo.evaluate((img: HTMLImageElement) => img.naturalWidth))
    .toBe(1878);

  await trigger.click();
  await expect(trigger).toHaveAttribute("aria-expanded", "true");
  await expect(page.locator(".sidebar .brand-link")).toBeFocused();
  await page.keyboard.press("Shift+Tab");
  await expect(page.getByRole("button", { name: "ログアウト" })).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(page.locator(".sidebar .brand-link")).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(trigger).toHaveAttribute("aria-expanded", "false");
  await expect(trigger).toBeFocused();
  await expect(firstSection).toHaveCount(0);

  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.locator("#ai").scrollIntoViewIfNeeded();
  await expect(
    page.getByRole("link", { name: "05 AI Transformation", exact: true }),
  ).toHaveAttribute("aria-current", "location");
  await page.locator("#risks").scrollIntoViewIfNeeded();
  await expect(
    page.getByRole("link", { name: "08 Risks & Actions", exact: true }),
  ).toHaveAttribute("aria-current", "location");
});
