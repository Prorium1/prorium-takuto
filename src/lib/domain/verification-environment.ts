// Verification is never an integration run against production services.
// Allow system settings only; arbitrary inherited app credentials and Node
// loader options must not reach test, build or fail-closed smoke processes.
export function verificationEnvironment(
  env: NodeJS.ProcessEnv = process.env,
): NodeJS.ProcessEnv {
  const safe: NodeJS.ProcessEnv = { NODE_ENV: "test" };
  for (const name of [
    "PATH",
    "HOME",
    "TMPDIR",
    "TEMP",
    "TMP",
    "SystemRoot",
    "ComSpec",
    "LANG",
    "LC_ALL",
    "TZ",
    "CI",
    "npm_config_cache",
    "npm_config_registry",
    "HTTP_PROXY",
    "HTTPS_PROXY",
    "NO_PROXY",
    "http_proxy",
    "https_proxy",
    "no_proxy",
    "NODE_EXTRA_CA_CERTS",
    "SSL_CERT_FILE",
  ]) {
    if (env[name] !== undefined) safe[name] = env[name];
  }
  return {
    ...safe,
    PRORIUM_ENV: "mock",
    INTERNAL_APP_ORIGIN: "http://127.0.0.1:3100",
    NEXT_DIST_DIR: ".next/build",
    PDF_CHROMIUM_PATH: env.PDF_CHROMIUM_PATH || "/usr/bin/chromium",
  };
}
import { lstat } from "node:fs/promises";
import path from "node:path";

// Next can load these files even after inherited environment variables have
// been removed. Refuse the run; never read, move or delete credential files.
export async function assertVerificationWorkspace(directory = process.cwd()) {
  for (const name of [
    ".env",
    ".env.local",
    ".env.production",
    ".env.production.local",
    ".env.development",
    ".env.development.local",
    ".env.test",
    ".env.test.local",
  ]) {
    try {
      await lstat(path.join(directory, name));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") continue;
      throw error;
    }
    throw new Error(
      "環境設定ファイルがあります。検証専用のクリーンな作業ディレクトリで実行してください。ファイルの内容は読み込んでいません。",
    );
  }
}
