import "server-only";
import { chromium } from "playwright-core";
import { isMockEnvironment, productionConfiguration } from "./environment";
export async function launchPdfBrowser() {
  if (isMockEnvironment())
    return chromium.launch({
      executablePath: process.env.PDF_CHROMIUM_PATH || "/usr/bin/chromium",
      headless: true,
      args: ["--no-sandbox", "--disable-dev-shm-usage"],
    });
  const { default: serverless } = await import("@sparticuz/chromium");
  return chromium.launch({
    executablePath: await serverless.executablePath(),
    headless: true,
    args: serverless.args,
  });
}
export function pdfOrigin() {
  if (!isMockEnvironment()) return new URL(productionConfiguration().origin);
  const origin = new URL(
    process.env.INTERNAL_APP_ORIGIN || "http://127.0.0.1:3000",
  );
  if (
    !["127.0.0.1", "localhost", "[::1]"].includes(origin.hostname) ||
    origin.protocol !== "http:"
  )
    throw new Error("Mock PDF origin must be local loopback");
  return origin;
}
