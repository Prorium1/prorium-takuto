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
export function requireMockEnvironment() {
  if (!isMockEnvironment()) throw new Error("この操作はMock環境専用です。");
}
const runtime = globalThis as typeof globalThis & {
  __proriumSessionKey?: string;
};
export function sessionKey() {
  requireMockEnvironment();
  runtime.__proriumSessionKey ??= randomBytes(32).toString("hex");
  return runtime.__proriumSessionKey;
}
