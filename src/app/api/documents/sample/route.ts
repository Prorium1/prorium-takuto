import { getActor } from "@/lib/server/auth";
import { isMockEnvironment } from "@/lib/server/environment";
import { mockStatementPdf } from "@/lib/mock/pdf";
export async function GET() {
  const actor = await getActor();
  if (!isMockEnvironment() || actor?.role !== "admin")
    return new Response(null, { status: 404 });
  return new Response(new Uint8Array(mockStatementPdf()), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition":
        'attachment; filename="Prorium-MOCK-statement.pdf"',
      "Cache-Control": "private, no-store",
    },
  });
}
