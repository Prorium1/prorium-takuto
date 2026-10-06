import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
const storeDirectory = await mkdtemp(path.join(tmpdir(), "prorium-e2e-"));
const child = spawn(
  process.execPath,
  [
    "node_modules/next/dist/bin/next",
    "dev",
    "--port",
    "3100",
    "--hostname",
    "127.0.0.1",
  ],
  {
    stdio: "inherit",
    env: {
      ...process.env,
      PRORIUM_ENV: "mock",
      MOCK_STORE_PATH: storeDirectory,
      NEXT_DIST_DIR: ".next/e2e",
      INTERNAL_APP_ORIGIN: "http://127.0.0.1:3100",
    },
  },
);
for (const signal of ["SIGINT", "SIGTERM"])
  process.on(signal, () => child.kill(signal));
child.on("exit", async (code) => {
  await rm(storeDirectory, { recursive: true, force: true });
  process.exitCode = code ?? 0;
});
