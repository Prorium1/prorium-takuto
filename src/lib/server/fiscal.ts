import "server-only";
import type { Actor } from "../domain/types";
import { fiscalSourceSchema } from "../domain/fiscal";
import { isMockEnvironment } from "./environment";
export async function getFiscalSource(actor: Actor, year: number) {
  if (
    actor.role !== "admin" ||
    !Number.isInteger(year) ||
    year < 2020 ||
    year > 2099
  )
    throw new Error("管理者権限・対象年度を確認してください。");
  if (isMockEnvironment()) {
    if (actor.companyId !== "prorium") return null;
    const { mockFiscalSource } = await import("../mock/fiscal");
    return mockFiscalSource(year);
  }
  const { productionClient, databaseError } =
    await import("./production-repository");
  const client = await productionClient(actor, true);
  const { data, error } = await client.rpc("ir_get_fiscal_briefing", {
    p_company: actor.companyId,
    p_year: year,
  });
  databaseError(error);
  if (data === null) return null;
  const result = fiscalSourceSchema.safeParse(data);
  if (!result.success || result.data.fiscalEndYear !== year) return null;
  return result.data;
}
