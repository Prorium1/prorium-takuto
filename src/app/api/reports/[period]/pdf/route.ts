import { launchPdfBrowser, pdfOrigin } from "@/lib/server/pdf-browser";
import { cookies } from "next/headers";
import { getActor, SESSION_COOKIE } from "@/lib/server/auth";
import { getPublishedReport, recordPdfExport } from "@/lib/server/repository";
import { periodSchema } from "@/lib/domain/validation";
import { isCloudMockPreview } from "@/lib/server/environment";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;
const counter = globalThis as typeof globalThis & {
  __proriumPdfCount?: number;
};
export async function GET(
  request: Request,
  context: { params: Promise<{ period: string }> },
) {
  const actor = await getActor();
  if (!actor)
    return Response.json({ error: "Authentication required" }, { status: 401 });
  const { period } = await context.params;
  if (!periodSchema.safeParse(period).success)
    return Response.json({ error: "Invalid period" }, { status: 400 });
  const version = new URL(request.url).searchParams.get("version") || undefined;
  const report = await getPublishedReport(period, actor, version);
  if (!report)
    return Response.json({ error: "Report not found" }, { status: 404 });
  if (isCloudMockPreview())
    return Response.json(
      { error: "Previewではレポート画面のPDF保存 / 印刷をご利用ください。" },
      { status: 501 },
    );
  if ((counter.__proriumPdfCount || 0) >= 2)
    return Response.json(
      { error: "PDF generation busy" },
      { status: 429, headers: { "Retry-After": "10" } },
    );
  counter.__proriumPdfCount = (counter.__proriumPdfCount || 0) + 1;
  let browser;
  try {
    const origin = pdfOrigin();
    const sessionCookies = (await cookies())
      .getAll()
      .filter((c) => c.name === SESSION_COOKIE || c.name.startsWith("sb-"));
    if (!sessionCookies.length)
      return Response.json(
        { error: "Authentication required" },
        { status: 401 },
      );
    browser = await launchPdfBrowser();
    const ctx = await browser.newContext({
      viewport: { width: 1200, height: 900 },
    });
    await ctx.addCookies(
      sessionCookies.map((c) => ({
        ...c,
        domain: origin.hostname,
        path: "/",
        httpOnly: true,
        secure: origin.protocol === "https:",
        sameSite: "Lax" as const,
      })),
    );
    const page = await ctx.newPage();
    await page.route("**/*", (route) =>
      new URL(route.request().url()).origin === origin.origin
        ? route.continue()
        : route.abort(),
    );
    await page.emulateMedia({ media: "print", reducedMotion: "reduce" });
    const response = await page.goto(
      `${origin.origin}/reports/${period}/print?version=${encodeURIComponent(report.version)}`,
      { waitUntil: "networkidle", timeout: 45_000 },
    );
    if (!response?.ok()) throw new Error("Print page unavailable");
    await page.locator(".monthly-report").waitFor();
    await page.evaluate(() => document.fonts.ready);
    const bytes = await page.pdf({
      format: "A4",
      printBackground: true,
      preferCSSPageSize: true,
      displayHeaderFooter: true,
      headerTemplate: "<span></span>",
      footerTemplate: `<div style="font:8px Arial;color:#9b9dad;width:100%;margin:0 12mm;display:flex;justify-content:space-between"><span>PRORIUM · ${report.content.financial.isMock ? "MOCK " : ""}SHAREHOLDER REPORT · ${period} · ${report.version}</span><span><span class="pageNumber"></span> / <span class="totalPages"></span></span></div>`,
    });
    await recordPdfExport(report.id, actor);
    return new Response(new Uint8Array(bytes), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="Prorium-${period}-${report.version}.pdf"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    console.error(
      "Report PDF export failed:",
      error instanceof Error ? error.message : "Unknown error",
    );
    return Response.json({ error: "PDF generation failed" }, { status: 503 });
  } finally {
    await browser?.close();
    counter.__proriumPdfCount = Math.max(
      0,
      (counter.__proriumPdfCount || 1) - 1,
    );
  }
}
