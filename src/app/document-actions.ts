"use server";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/server/auth";
import { detachFinancialDocument } from "@/lib/server/documents";
import { z } from "zod";
export async function detachDocumentAction(form: FormData) {
  const actor = await requireAdmin();
  const id = String(form.get("id"));
  await detachFinancialDocument(
    actor,
    id,
    z.coerce.number().int().positive().parse(form.get("revision")),
    z.uuid().parse(form.get("documentId")),
  );
  revalidatePath(`/admin/reports/${id}`);
}
