import { test, expect } from "@playwright/test";

test("mobile owner must save visible edits before review, preview or publication", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/login");
  await page.getByRole("button", { name: "管理者デモを開く" }).click();
  await page.waitForURL("**/admin");
  await page.goto("/admin/reports");
  await page.getByLabel("対象月").fill("2030-01");
  await page.getByLabel("文章とPDFで開始する").check();
  await page
    .getByRole("button", { name: "レポートを作成", exact: true })
    .click();
  await page.waitForURL(/\/admin\/reports\/[a-f0-9-]+$/);
  const editorUrl = page.url();
  await page
    .getByLabel("見出し", { exact: true })
    .fill("確認した内容だけを公開します。");
  await page
    .getByLabel("Executive Summary 本文")
    .fill("今月は講座の運営方法を確認しました。");
  await page
    .getByLabel("CEO コメント", { exact: true })
    .fill("継続して品質を確認します。");
  await expect(
    page.getByRole("button", { name: "レビューへ提出" }),
  ).toBeDisabled();
  await expect(
    page.getByText("未保存の入力があります。", { exact: false }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "プレビュー", exact: true }),
  ).toBeDisabled();
  await page.getByRole("button", { name: "変更を保存", exact: true }).click();
  await expect(page.getByText("保存しました。", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "レビューへ提出" }).click();
  await page.getByRole("button", { name: "内容を確認して承認" }).click();
  await expect(page.getByRole("button", { name: "株主へ公開" })).toBeEnabled();
  await page
    .getByLabel("見出し", { exact: true })
    .fill("公開前にもう一度修正しました。");
  await expect(page.getByRole("button", { name: "株主へ公開" })).toBeDisabled();
  await page.getByRole("button", { name: "変更を保存", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "レビューへ提出" }),
  ).toBeEnabled();
  await expect(page.getByRole("button", { name: "株主へ公開" })).toHaveCount(0);
  await page.reload();
  await expect(page.getByLabel("見出し", { exact: true })).toHaveValue(
    "公開前にもう一度修正しました。",
  );
  // Notes stay private and are durable across a mobile refresh, without
  // silently replacing the already edited public summary.
  const notes = "検討中の非公開原文です。今月の進捗を確認しました。";
  await page.getByLabel("今月あったこと").fill(notes);
  await expect(
    page.getByRole("button", { name: "レビューへ提出" }),
  ).toBeDisabled();
  await page.getByRole("button", { name: "入力を保存", exact: true }).click();
  await expect(
    page.getByText("今月の出来事を管理者専用に保存しました。", {
      exact: false,
    }),
  ).toBeVisible();
  await page.reload();
  await expect(page.getByLabel("今月あったこと")).toHaveValue(notes);
  await expect(page.getByLabel("見出し", { exact: true })).toHaveValue(
    "公開前にもう一度修正しました。",
  );
  expect(page.url()).toBe(editorUrl);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth,
    ),
  ).toBe(false);
});

test("normalized editor saves clear the guard and private notes saves preserve other edits", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/login");
  await page.getByRole("button", { name: "管理者デモを開く" }).click();
  await page.waitForURL("**/admin");
  await page.goto("/admin/reports");
  await page.getByLabel("対象月").fill("2030-03");
  await page.getByLabel("文章とPDFで開始する").check();
  await page
    .getByRole("button", { name: "レポートを作成", exact: true })
    .click();
  await page.waitForURL(/\/admin\/reports\/[a-f0-9-]+$/);
  const headline = page.getByLabel("見出し", { exact: true });
  const review = page.getByRole("button", { name: "レビューへ提出" });
  const save = page.getByRole("button", { name: "変更を保存", exact: true });
  const canonical = "確認済みの月次報告です。";
  await headline.fill(canonical);
  await page
    .getByLabel("Executive Summary 本文")
    .fill("今月の取り組みを確認しました。");
  await page
    .getByLabel("CEO コメント", { exact: true })
    .fill("品質の確認を継続します。");
  await save.click();
  await expect(review).toBeEnabled();
  await headline.fill(`${canonical} `);
  await expect(review).toBeDisabled();
  await save.click();
  await expect(headline).toHaveValue(canonical);
  await expect(review).toBeEnabled();
  // Saving raw private notes increments the report revision but must not
  // reset an independently edited, still-unsaved public headline.
  const unsaved = "本文の別の変更はまだ保存していません。";
  await headline.fill(unsaved);
  await page
    .getByLabel("今月あったこと")
    .fill("今月の出来事を管理者専用の原文として保存します。");
  await page.getByRole("button", { name: "入力を保存", exact: true }).click();
  await expect(
    page.getByText("今月の出来事を管理者専用に保存しました。", {
      exact: false,
    }),
  ).toBeVisible();
  await expect(headline).toHaveValue(unsaved);
  await expect(review).toBeDisabled();
  await save.click();
  await expect(review).toBeEnabled();
  await page.reload();
  await expect(headline).toHaveValue(unsaved);
});
