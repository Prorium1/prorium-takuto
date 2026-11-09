import { test, expect } from "@playwright/test";
test("annual review publishes an immutable investor page and PDF while draft access remains owner-only", async ({
  page,
  browser,
}) => {
  await page.goto("/login");
  await page.getByRole("button", { name: "管理者デモを開く" }).click();
  await page.waitForURL("**/admin");
  await expect(
    page.getByRole("heading", { name: "経営者のホーム", exact: true }),
  ).toBeVisible();
  await page.getByRole("link", { name: "報告を確認する", exact: true }).click();
  await expect(page).toHaveURL(/\/admin\/fiscal\/2026\/share$/);
  await expect(
    page.locator('.fiscal-workflow [aria-current="step"]'),
  ).toHaveText("1内容を確認");
  await page.getByRole("button", { name: "株主共有用の下書きを作成" }).click();
  await expect(page.getByLabel("社員数", { exact: true })).toHaveValue("8");
  await page
    .getByLabel("人数の対象範囲と基準日を確認しました", { exact: false })
    .check();
  await page
    .getByRole("button", { name: "入力内容を保存", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "確認して次へ進む", exact: true }),
  ).toBeEnabled();
  await expect(page.getByLabel("社員数", { exact: true })).not.toBeVisible();
  await page
    .getByRole("link", { name: "報告を開いて確認する", exact: true })
    .click();
  await expect(page).toHaveURL(/\/admin\/fiscal\/2026\/preview\?version=1$/);
  await page
    .getByRole("link", { name: "← 確認・公開の画面に戻る", exact: true })
    .click();
  await page.getByText("人数や文章を確認・修正する", { exact: true }).click();
  await page
    .getByLabel("人数・編成の補足", { exact: true })
    .fill("Mock: 人数と担当領域を確認しました。");
  await expect(
    page.getByRole("link", { name: "報告を開いて確認する", exact: true }),
  ).toHaveAttribute("aria-disabled", "true");
  await expect(
    page.getByRole("button", { name: "資料を保存（PDF）", exact: true }),
  ).toBeDisabled();
  await expect(
    page.getByRole("button", { name: "確認して次へ進む", exact: true }),
  ).toBeDisabled();
  await page
    .getByRole("button", { name: "入力内容を保存", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "確認して次へ進む", exact: true }),
  ).toBeEnabled();
  const context = await browser.newContext(),
    investor = await context.newPage();
  try {
    await investor.goto("/login");
    await investor
      .getByRole("button", { name: "株主としてデモを見る" })
      .click();
    await investor.waitForURL("**/dashboard");
    expect((await investor.goto("/fiscal/2026?version=1"))?.status()).toBe(404);
    expect(
      (
        await investor.request.get("/api/fiscal/2026/pdf?version=1&preview=1")
      ).status(),
    ).toBe(404);
    expect(
      (await investor.goto("/fiscal/2026/print?version=1&preview=1"))?.status(),
    ).toBe(404);
    await page
      .getByLabel("金額・人数・未確定の情報の表示を確認しました")
      .check();
    await page
      .getByRole("button", { name: "確認して次へ進む", exact: true })
      .click();
    await page
      .getByRole("button", { name: "この内容で承認する", exact: true })
      .click();
    await expect(
      page.locator('.fiscal-workflow [aria-current="step"]'),
    ).toHaveText("3株主に公開");
    expect((await investor.goto("/fiscal/2026?version=1"))?.status()).toBe(404);
    await page
      .getByRole("button", { name: "株主に公開する", exact: true })
      .click();
    await expect(
      page.getByRole("button", { name: "共有リンクをコピー" }),
    ).toBeVisible();
    await investor.goto("/dashboard");
    await expect(
      investor.getByRole("heading", { name: "2026年10月期 事業・経営報告" }),
    ).toBeVisible();
    for (const width of [390, 320]) {
      await investor.setViewportSize({ width, height: 900 });
      expect(
        await investor
          .locator(".fiscal-portal-card .kpi-card")
          .first()
          .evaluate((e) => e.getBoundingClientRect().top),
      ).toBeLessThan(900);
      expect(
        await investor.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
    }
    await investor.screenshot({
      path: "/tmp/prorium-annual-dashboard-mobile.png",
    });
    await investor.setViewportSize({ width: 1280, height: 900 });
    await investor.getByRole("link", { name: "今期の報告を見る" }).click();
    await expect(
      investor.getByRole("heading", { name: "事業を支える、人と体制。" }),
    ).toBeVisible();
    await expect(investor.locator(".fiscal-people-grid")).toContainText(
      "うち休業中 2名を含む",
    );
    await expect(investor.locator(".fiscal-people-grid")).toContainText(
      "確認中",
    );
    expect(await investor.content()).not.toContain(
      "https://example.test/school-a",
    );
    await expect(
      investor.getByRole("heading", { name: "参考シナリオを試す" }),
    ).toHaveCount(0);
    await investor
      .locator("#organization")
      .screenshot({ path: "/tmp/prorium-annual-organization-desktop.png" });
    for (const width of [375, 320]) {
      await investor.setViewportSize({ width, height: 900 });
      expect(
        await investor.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
    }
    await investor
      .locator("#organization")
      .screenshot({ path: "/tmp/prorium-annual-organization-mobile.png" });
    const response = await investor.request.get(
      "/api/fiscal/2026/pdf?version=1",
    );
    expect(response.status()).toBe(200);
    expect(response.headers()["content-type"]).toBe("application/pdf");
    expect((await response.body()).subarray(0, 4).toString()).toBe("%PDF");
    await investor.goto("/fiscal/2026/print?version=1");
    await investor.emulateMedia({ media: "print" });
    await expect(investor.locator(".fiscal-print-evidence")).toContainText(
      "データ取得日時（日本時間）",
    );
    await expect(investor.locator(".fiscal-print-evidence")).toContainText(
      "2026/10/23 09:00 JST",
    );
    await investor.emulateMedia({ media: "screen" });
    const { writeFile } = await import("node:fs/promises");
    await writeFile("/tmp/prorium-annual-published.pdf", await response.body());
    await page
      .getByRole("button", { name: "内容を直して新しい版を作る", exact: true })
      .click();
    await page.getByText("人数や文章を確認・修正する", { exact: true }).click();
    await expect(page.getByLabel("社員数", { exact: true })).toBeVisible();
    expect((await investor.goto("/fiscal/2026?version=2"))?.status()).toBe(404);
    expect((await investor.goto("/fiscal/2026?version=1"))?.status()).toBe(200);
  } finally {
    await context.close();
  }
  const anon = await browser.newContext();
  try {
    expect(
      (
        await anon.request.get(
          "http://127.0.0.1:3100/api/fiscal/2026/pdf?version=1",
        )
      ).status(),
    ).toBe(401);
  } finally {
    await anon.close();
  }
});
