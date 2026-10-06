import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import {
  productionConfigured,
  productionConfiguration,
} from "./lib/domain/runtime";
export async function proxy(request: NextRequest) {
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const dev = process.env.NODE_ENV === "development";
  const csp = `default-src 'self'; script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${dev ? " 'unsafe-eval'" : ""}; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'`;
  const headers = new Headers(request.headers);
  headers.set("x-nonce", nonce);
  headers.set("Content-Security-Policy", csp);
  let response = NextResponse.next({ request: { headers } });
  if (productionConfigured()) {
    const config = productionConfiguration();
    const client = createServerClient(config.url, config.key, {
      cookieOptions: {
        httpOnly: true,
        secure: true,
        sameSite: "lax",
        path: "/",
      },
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (values) => {
          for (const { name, value } of values)
            request.cookies.set(name, value);
          headers.set("cookie", request.headers.get("cookie") || "");
          response = NextResponse.next({ request: { headers } });
          for (const { name, value, options } of values)
            response.cookies.set(name, value, options);
        },
      },
    });
    if (request.cookies.getAll().some((c) => c.name.startsWith("sb-")))
      await client.auth.getUser();
  }
  response.headers.set("Content-Security-Policy", csp);
  response.headers.set("Cache-Control", "private, no-store, max-age=0");
  if (productionConfigured())
    response.headers.set(
      "Strict-Transport-Security",
      "max-age=31536000; includeSubDomains",
    );
  return response;
}
export const config = {
  matcher: ["/((?!_next/static|_next/image|icon.svg|favicon.ico).*)"],
};
