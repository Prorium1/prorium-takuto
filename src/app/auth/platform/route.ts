import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  productionConfigured,
  productionConfiguration,
} from "@/lib/server/environment";
import {
  createPlatformAttempt,
  platformAuthorizationUrl,
  SSO_COOKIE,
} from "@/lib/domain/platform-sso";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  if (!productionConfigured())
    return NextResponse.redirect(
      new URL("/login", "https://prorium-shareholder-ir.vercel.app"),
    );
  const config = productionConfiguration();
  if (new URL(request.url).origin !== config.origin)
    return NextResponse.redirect(`${config.origin}/auth/platform`);
  const attempt = createPlatformAttempt();
  (await cookies()).set(SSO_COOKIE, JSON.stringify(attempt), {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: 300,
  });
  // Always initiate at the canonical origin so the host-bound state cookie returns correctly.
  const response = NextResponse.redirect(platformAuthorizationUrl(attempt));
  response.headers.set("Cache-Control", "private, no-store");
  response.headers.set("Referrer-Policy", "no-referrer");
  return response;
}
