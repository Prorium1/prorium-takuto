import { cookies } from "next/headers";
import { getActor, SESSION_COOKIE } from "@/lib/server/auth";
import {
  getFiscalPublication,
  recordFiscalExport,
} from "@/lib/server/fiscal-publications";
import { launchPdfBrowser, pdfOrigin } from "@/lib/server/pdf-browser";
import { isCloudMockPreview } from "@/lib/server/environment";
import { fiscalVersionLabel } from "@/lib/domain/fiscal-publication";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;
const counter = globalThis as typeof globalThis & {
  __proriumFiscalPdfCount?: number;
};
export async function GET(
  request: Request,
  { params }: { params: Promise<{ year: string }> },
) {
  const actor = await getActor();
  if (!actor)
    return Response.json({ error: "Authentication required" }, { status: 401 });
  const { year } = await params,
    query = new URL(request.url).searchParams,
    preview = query.get("preview") === "1";
  const version = query.has("version")
    ? Number(query.get("version"))
    : undefined;
  const report = await getFiscalPublication(
    actor,
    Number(year),
    version,
    preview,
  );
  if (!report)
    return Response.json({ error: "Report not found" }, { status: 404 });
  if (isCloudMockPreview())
    return Response.json(
      { error: "確認用デモでは画面の印刷をご利用ください。" },
      { status: 501 },
    );
  if ((counter.__proriumFiscalPdfCount || 0) >= 2)
    return Response.json(
      { error: "PDF generation busy" },
      { status: 429, headers: { "Retry-After": "10" } },
    );
  counter.__proriumFiscalPdfCount = (counter.__proriumFiscalPdfCount || 0) + 1;
  let browser;
  try {
    const origin = pdfOrigin(),
      sessionCookies = (await cookies())
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
      `${origin.origin}/fiscal/${report.year}/print?version=${report.version}${preview ? "&preview=1" : ""}`,
      { waitUntil: "networkidle", timeout: 45000 },
    );
    if (!response?.ok()) throw new Error("Print page unavailable");
    await page
      .locator(`.fiscal-publication[data-content-hash="${report.contentHash}"]`)
      .waitFor();
    await page.evaluate(async () => {
      document.querySelectorAll("details").forEach((d) => (d.open = true));
      await document.fonts.ready;
    });
    const bytes = await page.pdf({
      format: "A4",
      printBackground: true,
      preferCSSPageSize: true,
      displayHeaderFooter: true,
      headerTemplate: "<span></span>",
      footerTemplate: `<div style="font:8px Arial;color:#64748b;width:100%;margin:0 12mm;display:flex;justify-content:space-between"><span>PRORIUM · ${report.state === "published" ? "CONFIDENTIAL" : "DRAFT / REVIEW COPY"} · FY${report.year} · ${fiscalVersionLabel(report.version)}</span><span><span class="pageNumber"></span> / <span class="totalPages"></span></span></div>`,
    });
    const current = await getFiscalPublication(
      actor,
      report.year,
      report.version,
      preview,
    );
    if (
      !current ||
      current.contentHash !== report.contentHash ||
      current.state !== report.state
    )
      return Response.json(
        { error: "資料が更新されました。再度PDFを保存してください。" },
        { status: 409 },
      );
    await recordFiscalExport(actor, report.id);
    return new Response(new Uint8Array(bytes), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="Prorium-FY${report.year}-${fiscalVersionLabel(report.version)}${report.state === "published" ? "" : "-review"}.pdf"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch {
    console.error("Fiscal PDF generation failed");
    return Response.json({ error: "PDF generation failed" }, { status: 503 });
  } finally {
    await browser?.close();
    counter.__proriumFiscalPdfCount = Math.max(
      0,
      (counter.__proriumFiscalPdfCount || 1) - 1,
    );
  }
}
