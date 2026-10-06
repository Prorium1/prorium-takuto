import "server-only";
import { createHash } from "node:crypto";
import { mockStatementPdf } from "../mock/pdf";
export function validatePdfUpload(
  bytes: Uint8Array,
  mime: string,
  fileName: string,
  mockOnly: boolean,
) {
  if (bytes.length > 4 * 1024 * 1024)
    throw new Error("PDFは4 MB以下にしてください。");
  const buffer = Buffer.from(bytes);
  if (
    !buffer.subarray(0, 5).equals(Buffer.from("%PDF-")) ||
    !buffer.subarray(-2048).includes(Buffer.from("%%EOF")) ||
    !["application/pdf", ""].includes(mime) ||
    !/^[^/\\\r\n]+\.pdf$/i.test(fileName)
  )
    throw new Error("有効なPDFファイルを選択してください。");
  const checksum = createHash("sha256").update(buffer).digest("hex");
  if (
    mockOnly &&
    checksum !== createHash("sha256").update(mockStatementPdf()).digest("hex")
  )
    throw new Error(
      "開発環境にはサンプルMock PDFだけ登録できます。サンプルPDFをダウンロードしてご利用ください。",
    );
  return { bytes: buffer.length, checksum, fileName };
}
export async function boundedFormData(request: Request) {
  const max = 4 * 1024 * 1024 + 64 * 1024;
  if (Number(request.headers.get("content-length")) > max)
    throw new Error("PDFは4 MB以下にしてください。");
  if (!request.body) throw new Error("ファイルがありません。");
  const reader = request.body.getReader(),
    chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.length;
    if (total > max) {
      await reader.cancel();
      throw new Error("PDFは4 MB以下にしてください。");
    }
    chunks.push(value);
  }
  return new Request(request.url, {
    method: "POST",
    headers: request.headers,
    body: Buffer.concat(chunks),
  }).formData();
}
export function validUploadOrigin(
  origin: string | null,
  configuredOrigin: string,
  mock: boolean,
) {
  if (!origin) return false;
  try {
    const actual = new URL(origin),
      expected = new URL(configuredOrigin);
    if (!mock) return actual.origin === expected.origin;
    return (
      actual.protocol === "http:" &&
      expected.protocol === "http:" &&
      ["localhost", "127.0.0.1", "[::1]"].includes(actual.hostname) &&
      ["localhost", "127.0.0.1", "[::1]"].includes(expected.hostname) &&
      actual.port === expected.port
    );
  } catch {
    return false;
  }
}
