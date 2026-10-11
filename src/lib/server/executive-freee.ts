import "server-only";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { freeeConfig } from "./freee";
import { encryptFreeeToken, decryptFreeeToken } from "../domain/freee-oauth";
import {
  parseExecutivePL,
  executiveFinancial,
} from "../domain/executive-finance";
import { monthlyFreeeWindow } from "../domain/freee-trial";
import { productionConfiguration, isMockEnvironment } from "./environment";
const GATEWAY =
  "https://acpwmxehprpcdyrsbfqe.supabase.co/functions/v1/ir-executive-gateway";
const periodSchema = z.string().regex(/^20\d{2}-(0[1-9]|1[0-2])$/);
async function gateway(action: string, owner: string, payload: unknown = {}) {
  const token = process.env.EXECUTIVE_GATEWAY_TOKEN;
  if (!token || token.length < 40)
    throw new Error("経営分析の同期設定が未完了です。");
  const r = await fetch(GATEWAY, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ action, owner, payload }),
    cache: "no-store",
    signal: AbortSignal.timeout(15000),
  });
  if (!r.ok)
    throw new Error("freee同期が実行中か、接続を確認できませんでした。");
  return await r.json();
}
export async function fetchExecutiveFreee(requested?: string) {
  if (isMockEnvironment() || process.env.VERCEL_ENV !== "production")
    throw new Error("財務取得は本番専用です。");
  if (requested) periodSchema.parse(requested);
  const config = freeeConfig();
  const company = productionConfiguration().companyId;
  const owner = randomUUID();
  const connection = await gateway("acquire", owner);
  try {
    if (
      connection.companyId !== company ||
      connection.freeeCompanyId !== config.companyId
    )
      throw new Error("freee接続の事業所が一致しません。");
    let token = decryptFreeeToken(
      connection.ciphertext,
      config.encryptionKey,
      company,
    );
    if (Date.parse(token.expires_at) < Date.now() + 90000) {
      const r = await fetch(
        "https://accounts.secure.freee.co.jp/public_api/token",
        {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            grant_type: "refresh_token",
            client_id: config.clientId,
            client_secret: config.clientSecret,
            refresh_token: token.refresh_token,
          }),
          cache: "no-store",
          signal: AbortSignal.timeout(15000),
        },
      );
      if (!r.ok)
        throw new Error(
          "freeeの再接続が必要です。IR管理画面のfreee接続から認可してください。",
        );
      const t = z
        .object({
          access_token: z.string().min(1),
          refresh_token: z.string().min(1),
          expires_in: z.number().int().positive(),
        })
        .parse(await r.json());
      token = {
        access_token: t.access_token,
        refresh_token: t.refresh_token,
        expires_at: new Date(
          Date.now() + (t.expires_in - 120) * 1000,
        ).toISOString(),
      };
      // Persist a rotated refresh token before fetching accounting data.
      await gateway("rotate", owner, {
        ciphertext: encryptFreeeToken(token, config.encryptionKey, company),
        expiresAt: token.expires_at,
      });
    }
    async function get(path: string, query: Record<string, string> = {}) {
      const url = new URL(`https://api.freee.co.jp/api/1/${path}`);
      for (const [k, v] of Object.entries(query)) url.searchParams.set(k, v);
      const r = await fetch(url, {
        headers: { Authorization: `Bearer ${token.access_token}` },
        cache: "no-store",
        signal: AbortSignal.timeout(20000),
      });
      if (!r.ok) throw new Error("freeeの財務データを取得できませんでした。");
      return await r.json();
    }
    const info = z
      .object({
        company: z.object({
          id: z.number(),
          fiscal_years: z.array(
            z.object({
              start_date: z.string(),
              end_date: z.string(),
              month_end_date: z.string().nullable(),
              temp_month_end_date: z.string().nullable(),
              is_closed: z.boolean(),
            }),
          ),
        }),
      })
      .parse(await get(`companies/${config.companyId}`));
    if (info.company.id !== config.companyId)
      throw new Error("freee事業所が一致しません。");
    const nowKey = new Intl.DateTimeFormat("sv-SE", {
      timeZone: "Asia/Tokyo",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date());
    const fiscal = info.company.fiscal_years.find(
      (y) => y.start_date <= nowKey && y.end_date >= nowKey,
    );
    if (!fiscal) throw new Error("現在の会計年度を確認できませんでした。");
    const close = {
      nativeClosedThrough: fiscal.is_closed
        ? fiscal.end_date
        : fiscal.month_end_date,
      temporaryClosedThrough: fiscal.temp_month_end_date,
    };
    const period = requested || close.nativeClosedThrough?.slice(0, 7);
    if (!period) return { months: [], close, waitingClose: true };
    const dates = monthlyFreeeWindow(period);
    if (dates.end >= nowKey)
      throw new Error("月途中の数値は月次分析に取り込めません。");
    const [year, month] = period.split("-").map(Number);
    const previous = new Date(Date.UTC(year, month - 2, 1))
      .toISOString()
      .slice(0, 7);
    const prior = `${year - 1}-${String(month).padStart(2, "0")}`;
    const values = await Promise.all(
      [period, previous, prior].map(async (p) => {
        const d = monthlyFreeeWindow(p);
        return parseExecutivePL(
          await get("reports/trial_pl", {
            company_id: String(config.companyId),
            start_date: d.start,
            end_date: d.end,
          }),
          config.companyId,
          p,
        );
      }),
    );
    const financial = executiveFinancial(
      period,
      values[0],
      values[1],
      values[2],
      close,
    );
    await gateway("store", owner, { months: [financial] });
    return { months: [financial], close, waitingClose: false };
  } finally {
    await gateway("release", owner).catch(() => {});
  }
}
