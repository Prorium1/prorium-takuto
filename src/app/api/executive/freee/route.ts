import { timingSafeEqual } from "node:crypto";
import { fetchExecutiveFreee } from "@/lib/server/executive-freee";
export const runtime = "nodejs";
export const maxDuration = 120;
export async function POST(request: Request) {
  const headers = {
    "Cache-Control": "private, no-store",
    "Referrer-Policy": "no-referrer",
  };
  const secret = process.env.EXECUTIVE_SYNC_SECRET;
  const input = Buffer.from(request.headers.get("authorization") || "");
  const expected = Buffer.from(`Bearer ${secret || ""}`);
  if (
    !secret ||
    secret.length < 40 ||
    input.length !== expected.length ||
    !timingSafeEqual(input, expected)
  )
    return Response.json({ error: "Access denied" }, { status: 401, headers });
  try {
    const body = await request.text();
    if (body.length > 1000) throw new Error("入力が大きすぎます。");
    const input = JSON.parse(body) as { period?: string };
    return Response.json(await fetchExecutiveFreee(input.period), { headers });
  } catch (error) {
    return Response.json(
      {
        error: error instanceof Error ? error.message : "同期に失敗しました。",
      },
      { status: 503, headers },
    );
  }
}
