import { z } from "zod";
export function mockEnabled(env: NodeJS.ProcessEnv = process.env) {
  if (env.VERCEL_ENV === "production") return false;
  return (
    env.PRORIUM_ENV === "mock" ||
    (env.NODE_ENV === "development" && !env.PRORIUM_ENV)
  );
}
export function productionConfigured(env: NodeJS.ProcessEnv = process.env) {
  return (
    env.NODE_ENV === "production" &&
    (!env.VERCEL_ENV || env.VERCEL_ENV === "production") &&
    env.PRORIUM_ENV === "production" &&
    Boolean(
      env.SUPABASE_URL &&
      env.SUPABASE_PUBLISHABLE_KEY &&
      env.PRORIUM_COMPANY_ID &&
      env.APP_ORIGIN,
    )
  );
}
export function productionConfiguration(env: NodeJS.ProcessEnv = process.env) {
  if (!productionConfigured(env))
    throw new Error("本番接続の設定が完了していません。");
  const config = z
    .object({
      url: z.url().startsWith("https://"),
      key: z.string().startsWith("sb_publishable_").min(20),
      companyId: z.uuid(),
      origin: z.url().startsWith("https://"),
    })
    .parse({
      url: env.SUPABASE_URL,
      key: env.SUPABASE_PUBLISHABLE_KEY,
      companyId: env.PRORIUM_COMPANY_ID,
      origin: env.APP_ORIGIN,
    });
  if (new URL(config.origin).origin !== config.origin)
    throw new Error("APP_ORIGINはHTTPSのOriginを指定してください。");
  if (
    new URL(config.url).protocol !== "https:" ||
    new URL(config.url).username ||
    new URL(config.url).password
  )
    throw new Error("Invalid Supabase URL");
  return config;
}
