"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/lib/server/auth";
import {
  editFiscalPublication,
  refreshFiscalPublication,
  prepareFiscalPublication,
  transitionFiscalPublication,
  fiscalPublicationWritesEnabled,
} from "@/lib/server/fiscal-publications";
export type FiscalActionState = { error?: string; success?: string };
export async function fiscalPublicationAction(
  _state: FiscalActionState,
  form: FormData,
): Promise<FiscalActionState> {
  const actor = await requireAdmin();
  try {
    if (!fiscalPublicationWritesEnabled())
      throw new Error("確認用デモでは実データの保存・公開はできません。");
    const year = z.coerce
      .number()
      .int()
      .min(2020)
      .max(2099)
      .parse(form.get("year"));
    const operation = z
      .enum(["prepare", "refresh", "save", "review", "approve", "publish"])
      .parse(form.get("operation"));
    if (operation === "prepare") await prepareFiscalPublication(actor, year);
    else {
      const id = z.uuid().parse(form.get("id")),
        revision = z.coerce
          .number()
          .int()
          .positive()
          .parse(form.get("revision"));
      if (operation === "refresh")
        await refreshFiscalPublication(actor, id, revision);
      else if (operation === "save") {
        const raw = String(form.get("editor") || "");
        if (raw.length > 30000) throw new Error("入力内容が大きすぎます。");
        await editFiscalPublication(actor, id, revision, JSON.parse(raw));
      } else
        await transitionFiscalPublication(
          actor,
          id,
          revision,
          operation,
          form.get("acknowledged") === "yes",
        );
    }
    for (const path of [
      `/admin/fiscal/${year}/share`,
      `/fiscal/${year}`,
      "/admin",
      "/dashboard",
      "/documents",
      "/shareholders",
    ])
      revalidatePath(path);
    return {
      success:
        operation === "publish"
          ? "株主専用ページへ公開しました。共有URLとPDFをご利用ください。"
          : operation === "approve"
            ? "この版を承認しました。公開すると株主が閲覧できます。"
            : "保存しました。プレビューで内容を確認できます。",
    };
  } catch (e) {
    return {
      error:
        e instanceof z.ZodError
          ? e.issues[0]?.message
          : e instanceof Error
            ? e.message
            : "保存できませんでした。",
    };
  }
}
