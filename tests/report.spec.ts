import { test, expect, type Page } from "@playwright/test";

async function demo(page: Page, role: "investor" | "admin") {
  await page.goto("/login");
  await page
    .getByRole("button", {
      name: role === "admin" ? "管理者デモを開く" : "株主としてデモを見る",
    })
    .click();
  await page.waitForURL(
    role === "admin" ? "**/admin" : /\/reports\/20\d{2}-\d{2}$/,
  );
  if (role === "investor") await page.goto("/reports/2026-08");
}
test("anonymous users cannot read any protected page or PDF", async ({
  page,
  request,
}) => {
  for (const route of [
    "/dashboard",
    "/reports",
    "/reports/2026-08",
    "/admin",
    "/admin/reports",
    "/admin/import",
    "/admin/reports/report-2026-09-v1-0",
    "/reports/2026-08/print",
  ]) {
    await page.goto(route);
    await expect(page).toHaveURL(/\/login$/);
  }
  expect((await request.get("/api/reports/2026-08/pdf")).status()).toBe(401);
});
test("login rejects invalid credentials and recognizes the investor account", async ({
  page,
}) => {
  await page.goto("/login");
  await page.getByLabel("メールアドレス").fill("investor@prorium.example");
  await page.getByLabel("パスワード").fill("wrong");
  await page.getByRole("button", { name: "ログイン", exact: true }).click();
  await expect(page.locator(".login-form").getByRole("alert")).toContainText(
    "正しくありません",
  );
  await page.getByLabel("パスワード").fill("prorium-demo");
  await page.getByRole("button", { name: "ログイン", exact: true }).click();
  await expect(page).toHaveURL(/\/reports\/2026-08$/);
});
test("investors see all nine sections and only published versions", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await demo(page, "investor");
  await expect(page.locator(".kpi-card")).toHaveCount(4);
  await expect(page.locator("section.report-section")).toHaveCount(9);
  await expect(page.locator(".kpi-card").first()).toContainText("52.64");
  await expect(page.locator(".kpi-card").first()).toContainText("+31.6%");
  await expect(
    page.getByRole("heading", { name: "AI Transformation", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".indicator-kind")).toHaveText([
    "Actual",
    "Committed",
    "Forecast",
    "Pipeline",
  ]);
  await expect(page.locator(".mock-badge")).toContainText("MOCK DATA");
  for (const route of [
    "/admin",
    "/admin/import",
    "/admin/reports/report-2026-09-v1-0?preview=1",
    "/reports/2026-09",
    "/reports/2026-08?version=v1.1",
    "/reports/2026-09/print",
  ]) {
    const response = await page.goto(route);
    expect(response?.status()).toBe(404);
    await expect(page.getByText("このページは表示できません。")).toBeVisible();
  }
  expect((await page.request.get("/api/reports/2026-09/pdf")).status()).toBe(
    404,
  );
  expect(errors).toEqual([]);
});
test("charts, archive and responsive navigation work without overflow", async ({
  page,
}) => {
  await demo(page, "investor");
  await page.getByRole("button", { name: "営業利益", exact: true }).click();
  await page.getByRole("button", { name: "3か月", exact: true }).click();
  await page.getByRole("button", { name: "数値を見る" }).click();
  await expect(page.locator(".chart-card tbody tr")).toHaveCount(3);
  await expect(page.locator(".chart-stat")).toContainText("8.42");
  for (const width of [1440, 768, 375, 320]) {
    await page.setViewportSize({ width, height: 900 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
  }
  await page.getByRole("button", { name: "メニューを開く" }).click();
  await page.getByRole("link", { name: "07 Forward Indicators" }).click();
  await expect(page).toHaveURL(/#forward$/);
  await page.goto("/reports");
  await expect(page.locator(".archive-card")).toHaveCount(3);
  await expect(page.locator(".archive-grid")).not.toContainText("2026年9月");
});
test("PDF is a real authorized multi-page export with mock attribution", async ({
  page,
}, testInfo) => {
  await demo(page, "investor");
  const response = await page.request.get(
    "/api/reports/2026-08/pdf?version=v1.0",
    { timeout: 60_000 },
  );
  expect(response.status()).toBe(200);
  expect(response.headers()["content-type"]).toBe("application/pdf");
  const pdf = await response.body();
  expect(pdf.subarray(0, 5).toString()).toBe("%PDF-");
  expect(pdf.length).toBeGreaterThan(20_000);
  await testInfo.attach("August report PDF", {
    body: pdf,
    contentType: "application/pdf",
  });
  await page.goto("/reports/2026-08/print");
  await expect(page.locator(".print-header")).toContainText("MOCK DATA");
  await expect(page.locator("section.report-section")).toHaveCount(9);
});
test("admin creates, edits, generates, approves, publishes and revises without changing the prior version", async ({
  page,
  browser,
}) => {
  await demo(page, "admin");
  await page.goto("/admin/reports");
  await page.getByLabel("対象月").fill("2026-10");
  await page.getByRole("button", { name: "レポートを作成" }).click();
  await page.waitForURL(/\/admin\/reports\/[a-f0-9-]+$/);
  const editorUrl = page.url();
  await page.getByRole("button", { name: "Mock AI Draftを生成" }).click();
  await expect(page.getByRole("status")).toContainText("Draftを生成");
  await page
    .getByLabel("CEO コメント", { exact: true })
    .fill("これは承認済みサンプルコメントです。");
  await page.getByRole("button", { name: "変更を保存" }).click();
  await expect(page.locator(".admin-editor").getByRole("status")).toContainText(
    "保存しました",
  );
  await expect(page.locator(".workflow-step.current")).toContainText("Draft");
  const investorContext = await browser.newContext();
  const investor = await investorContext.newPage();
  await demo(investor, "investor");
  expect((await investor.goto("/reports/2026-10"))?.status()).toBe(404);
  await page.getByRole("button", { name: "レビューへ提出" }).click();
  await expect(page.locator(".workflow-step.current")).toContainText(
    "Human Review",
  );
  await page.getByRole("button", { name: "内容を確認して承認" }).click();
  await expect(page.locator(".workflow-step.current")).toContainText(
    "Approved",
  );
  await page
    .getByLabel("CEO 見出し", { exact: true })
    .fill("承認後の変更を検証するサンプル。");
  await page.getByRole("button", { name: "変更を保存" }).click();
  await expect(page.getByRole("button", { name: "変更を保存" })).toBeEnabled();
  await expect(page.locator(".workflow-step.current")).toContainText("Draft");
  await expect(page.getByRole("button", { name: "株主へ公開" })).toHaveCount(0);
  await page.getByRole("button", { name: "レビューへ提出" }).click();
  await page.getByRole("button", { name: "内容を確認して承認" }).click();
  await page.getByRole("button", { name: "株主へ公開" }).click();
  await expect(page.locator(".workflow-step.current")).toContainText(
    "Published",
  );
  await expect(page.getByRole("button", { name: "変更を保存" })).toHaveCount(0);
  expect((await investor.goto("/reports/2026-10?version=v1.0"))?.status()).toBe(
    200,
  );
  await expect(investor.locator(".ceo-content")).toContainText(
    "これは承認済みサンプルコメントです。",
  );
  const oldSummary = await investor.locator(".executive-content").innerText();
  await page.getByRole("button", { name: "改訂版を作成" }).click();
  await page.waitForURL(
    (url) =>
      url.href !== editorUrl && /\/admin\/reports\/[a-f0-9-]+$/.test(url.href),
  );
  await expect(page.locator(".page-heading")).toContainText("v1.1");
  expect((await investor.goto("/reports/2026-10?version=v1.1"))?.status()).toBe(
    404,
  );
  await page.goto("/admin/import");
  await page.getByRole("button", { name: "MockデータをImport" }).click();
  await expect(page.getByRole("status")).toContainText("新しいSnapshot");
  await expect(page.locator(".data-table")).toContainText("Validated");
  await investor.goto("/reports/2026-10?version=v1.0");
  expect(await investor.locator(".executive-content").innerText()).toBe(
    oldSummary,
  );
  await page.goto("/admin");
  await expect(page.locator(".admin-panel").last()).toContainText("revision");
  await investorContext.close();
});
test("tampered session cookies cannot be used to escalate privileges", async ({
  page,
  context,
}) => {
  await demo(page, "investor");
  const cookie = (await context.cookies()).find(
    (c) => c.name === "prorium_mock_session",
  )!;
  await context.addCookies([{ ...cookie, value: cookie.value + "tampered" }]);
  await page.goto("/admin");
  await expect(page).toHaveURL(/\/login$/);
  await page.goto("/reports/2026-08");
  await expect(page).toHaveURL(/\/login$/);
});
