import "server-only";
import { randomUUID, createHash } from "node:crypto";
import { mkdir, writeFile, readFile } from "node:fs/promises";
import path from "node:path";
import type { Actor, StoredDocument } from "../domain/types";
import { documentMetadataSchema } from "../domain/documents";
import { isMockEnvironment } from "./environment";
import { productionClient, databaseError } from "./production-repository";
import * as mock from "./mock-repository";
import { validatePdfUpload } from "./pdf-validation";
function mapDocument(row: Record<string, unknown>): StoredDocument {
  return {
    id: String(row.id),
    companyId: String(row.company_id),
    versionId: String(row.version_id),
    title: String(row.title),
    category: row.category as StoredDocument["category"],
    period: String(row.period),
    basis: row.basis as StoredDocument["basis"],
    description: String(row.description),
    fileName: String(row.file_name),
    bytes: Number(row.bytes),
    checksum: String(row.checksum),
    storagePath: String(row.storage_path),
    status: row.status as StoredDocument["status"],
    uploadedAt: new Date(String(row.created_at)).toISOString(),
  };
}
const mockFile = (id: string) =>
  path.join(
    process.env.MOCK_STORE_PATH || path.join(process.cwd(), ".data"),
    "documents",
    `${id}.pdf`,
  );
export async function uploadFinancialDocument(
  actor: Actor,
  versionId: string,
  revision: number,
  file: File,
  metadata: unknown,
) {
  const bytes = new Uint8Array(await file.arrayBuffer());
  const checked = validatePdfUpload(
    bytes,
    file.type,
    file.name,
    isMockEnvironment(),
  );
  const input = documentMetadataSchema.parse({
    ...(metadata as object),
    ...checked,
  });
  if (isMockEnvironment()) {
    const report = await mock.getAdminReport(versionId, actor);
    if (!report || report.period !== input.period)
      throw new Error("対象月を確認してください。");
    const id = randomUUID();
    const document: StoredDocument = {
      ...input,
      id,
      companyId: actor.companyId,
      versionId,
      storagePath: id,
      status: "ready",
      uploadedAt: new Date().toISOString(),
    };
    const target = mockFile(id);
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, bytes, { mode: 0o600 });
    return mock.addMockDocument(versionId, actor, revision, document);
  }
  const client = await productionClient(actor, true);
  const { data, error } = await client.rpc("ir_reserve_document", {
    p_id: versionId,
    p_revision: revision,
    p_metadata: input,
  });
  databaseError(error);
  const row = Array.isArray(data) ? data[0] : data;
  const { error: uploadError } = await client.storage
    .from("ir-financial-documents")
    .upload(row.storage_path, bytes, {
      contentType: "application/pdf",
      upsert: false,
      cacheControl: "0",
    });
  databaseError(uploadError);
  const { error: attachError } = await client.rpc("ir_attach_document", {
    p_id: versionId,
    p_revision: revision,
    p_document: row.id,
  });
  databaseError(attachError);
}
export async function listFinancialDocuments(
  actor: Actor,
): Promise<StoredDocument[]> {
  if (isMockEnvironment()) return mock.listDocuments(actor);
  const client = await productionClient(actor);
  const { data, error } = await client
    .from("ir_documents")
    .select("*")
    .eq("company_id", actor.companyId)
    .eq("status", "ready")
    .order("period", { ascending: false });
  databaseError(error);
  return (data || []).map(mapDocument);
}
export async function downloadFinancialDocument(actor: Actor, id: string) {
  const document = (await listFinancialDocuments(actor)).find(
    (d) => d.id === id,
  );
  if (!document) return null;
  let bytes: Uint8Array;
  if (isMockEnvironment()) bytes = await readFile(mockFile(id));
  else {
    const client = await productionClient(actor);
    const { data, error } = await client.storage
      .from("ir-financial-documents")
      .download(document.storagePath);
    databaseError(error);
    if (!data) return null;
    bytes = new Uint8Array(await data.arrayBuffer());
  }
  if (
    bytes.length !== document.bytes ||
    createHash("sha256").update(bytes).digest("hex") !== document.checksum
  )
    throw new Error("ファイルの整合性を確認できません。");
  validatePdfUpload(
    bytes,
    "application/pdf",
    document.fileName,
    isMockEnvironment(),
  );
  if (isMockEnvironment()) await mock.recordDocumentDownload(id, actor);
  else {
    const client = await productionClient(actor);
    const { error } = await client.rpc("ir_record_document_download", {
      p_id: id,
    });
    databaseError(error);
  }
  return { document, bytes };
}
export async function detachFinancialDocument(
  actor: Actor,
  id: string,
  revision: number,
  documentId: string,
) {
  if (isMockEnvironment())
    return mock.detachDocument(id, actor, revision, documentId);
  const client = await productionClient(actor, true);
  const { error } = await client.rpc("ir_detach_document", {
    p_id: id,
    p_revision: revision,
    p_document: documentId,
  });
  databaseError(error);
}
