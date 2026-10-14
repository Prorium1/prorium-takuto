"use server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/server/auth";
import { saveOwnership } from "@/lib/server/ownership";
import { isCloudMockPreview } from "@/lib/server/environment";
export type OwnershipActionState = {
  error?: string;
  success?: string;
  revision?: number;
};
export async function saveOwnershipAction(
  _state: OwnershipActionState,
  form: FormData,
): Promise<OwnershipActionState> {
  const actor = await requireAdmin();
  try {
    if (form.get("confirmed") !== "yes")
      return {
        error: "元の株主名簿と表示範囲を確認してから保存してください。",
      };
    const revision = z.coerce
      .number()
      .int()
      .positive()
      .parse(form.get("revision"));
    const id = z.string().min(1).max(100).parse(form.get("id"));
    const raw = String(form.get("ownership") || "");
    if (raw.length > 25_000) return { error: "株主構成の入力が大きすぎます。" };
    if (isCloudMockPreview())
      return {
        error:
          "確認用デモでは入力を保存しません。本番の株主情報は入力しないでください。",
      };
    const report = await saveOwnership(id, actor, revision, JSON.parse(raw));
    revalidatePath("/admin/shareholders");
    revalidatePath(`/admin/reports/${id}`);
    revalidatePath("/dashboard");
    revalidatePath("/shareholders");
    return {
      success:
        "株主構成を非公開の下書きに保存しました。レポートの確認・承認・公開後に株主へ表示されます。",
      revision: report.revision,
    };
  } catch (error) {
    return {
      error:
        error instanceof z.ZodError
          ? error.issues[0]?.message || "入力内容を確認してください。"
          : error instanceof Error
            ? error.message
            : "保存できませんでした。入力はこの画面に残っています。",
    };
  }
}
