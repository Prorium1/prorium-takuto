import { test, expect } from "@playwright/test";

test("cloud preview structures reflection locally without saving or sending private notes", async ({
  page,
}) => {
  await page.goto("/login");
  await page.getByRole("button", { name: "管理者デモを開く" }).click();
  await page.waitForURL(/\/admin$/);
  await page.getByRole("link", { name: "振り返りを試す →" }).click();
  await expect(page.getByRole("button", { name: "入力を保存" })).toHaveCount(0);
  const posts: string[] = [];
  page.on("request", (request) => {
    if (request.method() === "POST") posts.push(request.url());
  });
  await page.getByRole("button", { name: "サンプルを入れる" }).click();
  await page.getByText("非公開メモ", { exact: true }).click();
  await page.getByLabel("管理者専用メモ").fill("private-canary-do-not-send");
  await page.getByRole("button", { name: "下書きを確認", exact: true }).click();
  const draft = page.getByRole("article", { name: "確認用の下書き" });
  await expect(draft).toContainText("売上の変化理由（経営者の説明）");
  await expect(draft).toContainText("未計測");
  await expect(draft).not.toContainText("private-canary");
  expect(posts).toEqual([]);
  await page.setViewportSize({ width: 375, height: 900 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "artifacts/cloud-reflection-mobile.png",
    fullPage: true,
  });
  await page.reload();
  await expect(page.getByLabel("今月あったこと", { exact: true })).toHaveValue(
    "",
  );
  await expect(draft).toHaveCount(0);
});

test("cloud investor only sees published fixtures and can print the report", async ({
  page,
}) => {
  await page.goto("/login");
  await page.getByRole("button", { name: "株主としてデモを見る" }).click();
  await page.waitForURL(/\/reports\/20\d{2}-\d{2}$/);
  await page.goto("/reports/2026-08");
  await expect(page.getByText("確認用デモ", { exact: true })).toBeVisible();
  await page.evaluate(() => {
    window.print = () => {
      document.body.dataset.printed = "yes";
    };
  });
  await page.getByRole("button", { name: "PDF保存 / 印刷" }).click();
  await expect(page.locator("body")).toHaveAttribute("data-printed", "yes");
  const pdf = await page.request.get("/api/reports/2026-08/pdf");
  expect(pdf.status()).toBe(501);
  const admin = await page.goto("/admin");
  expect(admin?.status()).toBe(404);
  const draft = await page.goto("/reports/2026-09");
  expect(draft?.status()).toBe(404);
});

test("solid chart and event layout remain readable on desktop and mobile", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/login");
  await page.getByRole("button", { name: "株主としてデモを見る" }).click();
  await page.waitForURL(/\/reports\/20\d{2}-\d{2}$/);
  await page.goto("/reports/2026-08");
  await expect(page.locator(".chart-series")).toHaveCount(2);
  expect(
    await page
      .locator(".chart-series-prior")
      .evaluate((el) => getComputedStyle(el).strokeDasharray),
  ).toBe("none");
  await expect(page.locator(".chart-prior-value")).toContainText("差額");
  await page.getByRole("button", { name: "営業利益", exact: true }).click();
  await page.getByRole("button", { name: "数値を見る" }).click();
  await expect(page.locator(".data-table").first()).toBeVisible();
  await expect(page.locator("#event")).toContainText("過去開催の振り返り");
  await expect(page.locator("#event iframe")).toHaveCount(0);
  for (const width of [1440, 768, 375]) {
    await page.setViewportSize({ width, height: 1000 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: `artifacts/report-refined-${width}.png`,
      fullPage: true,
    });
  }
  await page.emulateMedia({ reducedMotion: "reduce" });
  expect(
    await page
      .locator(".chart-series-current")
      .evaluate((el) => getComputedStyle(el).animationName),
  ).toBe("none");
  await page.emulateMedia({ media: "print" });
  await page.screenshot({
    path: "artifacts/report-refined-print.png",
    fullPage: true,
  });
  expect(errors).toEqual([]);
});

test("email callback removes session tokens from browser history before handling them", async ({
  page,
}) => {
  const access = "a".repeat(120);
  const refresh = "b".repeat(40);
  await page.goto(
    `/auth/complete#access_token=${access}&refresh_token=${refresh}`,
  );
  await expect(page.locator(".auth-complete-page .form-error")).toContainText(
    "ログインを完了できませんでした",
  );
  expect(new URL(page.url()).hash).toBe("");
  expect(await page.locator("body").innerText()).not.toContain(access);
  expect(await page.locator("body").innerText()).not.toContain(refresh);
});
