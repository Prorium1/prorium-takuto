import "server-only";
import { randomBytes } from "node:crypto";
import { mockEnabled } from "../domain/runtime";
export {
  productionConfigured,
  productionConfiguration,
} from "../domain/runtime";

export function isMockEnvironment() {
  return mockEnabled();
}
export function isCloudMockPreview() {
  return isMockEnvironment() && process.env.VERCEL_ENV === "preview";
}
export function requireMockEnvironment() {
  if (!isMockEnvironment()) throw new Error("この操作はMock環境専用です。");
}
const runtime = globalThis as typeof globalThis & {
  __proriumSessionKey?: string;
};
export function sessionKey() {
  requireMockEnvironment();
  if (isCloudMockPreview()) {
    const key = process.env.MOCK_SESSION_SECRET;
    if (!key || key.length < 32)
      throw new Error("Previewのセッション設定が完了していません。");
    return key;
  }
  runtime.__proriumSessionKey ??= randomBytes(32).toString("hex");
  return runtime.__proriumSessionKey;
}
