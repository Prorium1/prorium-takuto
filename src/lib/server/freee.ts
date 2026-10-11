import "server-only";
import { z } from "zod";
import { productionConfiguration } from "./environment";

export function freeeConfig() {
  const production = productionConfiguration();
  const config = z.object({
    clientId: z.string().min(1),
    clientSecret: z.string().min(1),
    companyId: z.coerce.number().int().positive(),
    encryptionKey: z.string().min(40),
  }).parse({
    clientId: process.env.FREEE_CLIENT_ID,
    clientSecret: process.env.FREEE_CLIENT_SECRET,
    companyId: process.env.FREEE_COMPANY_ID,
    encryptionKey: process.env.FREEE_TOKEN_ENCRYPTION_KEY,
  });
  return { ...config, redirectUri: `${production.origin}/api/integrations/freee/callback` };
}

const tokenResponse = z.object({
  access_token: z.string().min(1),
  refresh_token: z.string().min(1),
  expires_in: z.number().int().positive(),
  company_id: z.coerce.number().int().positive(),
});

export async function exchangeFreeeCode(code: string) {
  const config = freeeConfig();
  const response = await fetch("https://accounts.secure.freee.co.jp/public_api/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      client_id: config.clientId,
      client_secret: config.clientSecret,
      code,
      redirect_uri: config.redirectUri,
    }),
    cache: "no-store",
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) throw new Error("freeeの認証が完了しませんでした。");
  const result = tokenResponse.parse(await response.json());
  if (result.company_id !== config.companyId) throw new Error("選択されたfreee事業所がProriumの設定と一致しません。");
  return {
    companyId: result.company_id,
    accessToken: result.access_token,
    refreshToken: result.refresh_token,
    expiresAt: new Date(Date.now() + Math.max(60, result.expires_in - 120) * 1000).toISOString(),
  };
}
