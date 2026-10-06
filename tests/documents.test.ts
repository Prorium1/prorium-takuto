import test from "node:test";
import assert from "node:assert/strict";
import {
  validatePdfUpload,
  validUploadOrigin,
} from "../src/lib/server/pdf-validation";
import { mockStatementPdf } from "../src/lib/mock/pdf";
test("PDF uploads reject oversized, mislabeled or real development files", () => {
  const bytes = mockStatementPdf();
  const metadata = validatePdfUpload(
    bytes,
    "application/pdf",
    "statement.pdf",
    true,
  );
  assert.equal(metadata.bytes, bytes.length);
  assert.match(metadata.checksum, /^[a-f0-9]{64}$/);
  assert.throws(
    () =>
      validatePdfUpload(
        new Uint8Array(4 * 1024 * 1024 + 1),
        "application/pdf",
        "big.pdf",
        false,
      ),
    /4 MB/,
  );
  assert.throws(
    () =>
      validatePdfUpload(
        Buffer.from("<html>hello</html>"),
        "application/pdf",
        "bad.pdf",
        false,
      ),
    /PDF/,
  );
  assert.throws(
    () =>
      validatePdfUpload(
        Buffer.from("%PDF-1.4\nreal financial text\n%%EOF"),
        "application/pdf",
        "real.pdf",
        true,
      ),
    /Mock/,
  );
});
test("upload origin allows the configured development loopback aliases and rejects cross-origin requests", () => {
  assert.equal(
    validUploadOrigin("http://127.0.0.1:3100", "http://localhost:3100", true),
    true,
  );
  assert.equal(
    validUploadOrigin(
      "https://attacker.example",
      "http://localhost:3100",
      true,
    ),
    false,
  );
  assert.equal(
    validUploadOrigin("http://localhost:3101", "http://localhost:3100", true),
    false,
  );
  assert.equal(
    validUploadOrigin(
      "https://ir.prorium.example",
      "https://ir.prorium.example",
      false,
    ),
    true,
  );
  assert.equal(
    validUploadOrigin(null, "https://ir.prorium.example", false),
    false,
  );
});
