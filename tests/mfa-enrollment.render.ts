import test from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MfaEnrollmentGuide } from "../src/components/mfa-enrollment-guide";

test("MFA setup explains where the code appears and offers a manual key", () => {
  const html = renderToStaticMarkup(
    createElement(MfaEnrollmentGuide, {
      qrCode: "data:image/svg+xml;base64,PHN2Zy8+",
      secret: "FAKESETUPKEY123",
    }),
  );
  assert.match(html, /認証アプリ/);
  assert.match(html, /アプリに表示された6桁/);
  assert.match(html, /FAKESETUPKEY123/);
  assert.match(html, /セットアップキーを入力/);
  assert.match(html, /認証アプリ登録用のQRコード/);
});
