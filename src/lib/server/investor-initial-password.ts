import "server-only";
import { mockEnabled, productionConfigured } from "../domain/runtime";

// Read only on the production server. Never pass this setting as a page prop.
export function investorInitialPassword(env: NodeJS.ProcessEnv = process.env) {
  if (mockEnabled(env) || !productionConfigured(env)) return null;
  const value = env.INVESTOR_INITIAL_PASSWORD;
  if (value === undefined) return null;
  if (
    value.length < 6 ||
    value.length > 128 ||
    /[\u0000-\u0020\u007f]/.test(value)
  )
    throw new Error("投資家の初期パスワード設定を確認してください。");
  return value;
}
