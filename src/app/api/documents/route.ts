import { getActor } from "@/lib/server/auth";
import {
  boundedFormData,
  validUploadOrigin,
} from "@/lib/server/pdf-validation";
import { uploadFinancialDocument } from "@/lib/server/documents";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import {
  isMockEnvironment,
  productionConfigured,
  productionConfiguration,
} from "@/lib/server/environment";
export const runtime = "nodejs";
export async function POST(request: Request) {
  const actor = await getActor();
  if (!actor)
    return Response.json({ error: "Authentication required" }, { status: 401 });
  if (actor.role !== "admin" || actor.needsMfa)
    return Response.json({ error: "Admin MFA required" }, { status: 403 });
  const origin = request.headers.get("origin");
  const expected = productionConfigured()
    ? productionConfiguration().origin
    : process.env.INTERNAL_APP_ORIGIN || new URL(request.url).origin;
  if (!validUploadOrigin(origin, expected, isMockEnvironment()))
    return Response.json({ error: "Invalid origin" }, { status: 403 });
  try {
    const form = await boundedFormData(request);
    const file = form.get("file");
    if (!(file instanceof File)) throw new Error("PDFを選択してください。");
    const id = (
      isMockEnvironment() ? z.string().regex(/^[a-zA-Z0-9-]{1,100}$/) : z.uuid()
    ).parse(form.get("versionId"));
    const revision = z.coerce
      .number()
      .int()
      .positive()
      .parse(form.get("revision"));
    await uploadFinancialDocument(actor, id, revision, file, {
      title: form.get("title"),
      category: form.get("category"),
      period: form.get("period"),
      basis: form.get("basis"),
      description: form.get("description") || "",
    });
    revalidatePath(`/admin/reports/${id}`);
    revalidatePath("/documents");
    return Response.json({
      success:
        "財務PDFを添付しました。承認・公開後に株主がダウンロードできます。",
    });
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof z.ZodError
            ? "対象月・資料名・PDF形式を確認してください。"
            : error instanceof Error
              ? error.message
              : "アップロードできませんでした。",
      },
      { status: 400 },
    );
  }
}
