import { z } from "zod";
import { getActor } from "@/lib/server/auth";
import { downloadFinancialDocument } from "@/lib/server/documents";
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const actor = await getActor();
  if (!actor)
    return Response.json({ error: "Authentication required" }, { status: 401 });
  const { id } = await params;
  if (!z.uuid().safeParse(id).success)
    return Response.json({ error: "Not found" }, { status: 404 });
  try {
    const result = await downloadFinancialDocument(actor, id);
    if (!result) return Response.json({ error: "Not found" }, { status: 404 });
    return new Response(new Uint8Array(result.bytes), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="financial-statement.pdf"; filename*=UTF-8''${encodeURIComponent(result.document.fileName)}`,
        "Cache-Control": "private, no-store",
        "Content-Security-Policy": "sandbox; default-src 'none'",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return Response.json({ error: "Download unavailable" }, { status: 503 });
  }
}
