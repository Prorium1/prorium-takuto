import { spawn } from "node:child_process";
import { mkdtemp, rm, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { tmpdir } from "node:os";
import {
  assertVerificationWorkspace,
  verificationEnvironment,
} from "../src/lib/domain/verification-environment.ts";

// Read-only release preparation. It does not deploy, migrate or send messages.
await assertVerificationWorkspace();
const env = verificationEnvironment();
const store = await mkdtemp(path.join(tmpdir(), "prorium-release-"));
env.MOCK_STORE_PATH = store;
const steps = [
  ["checks", "npm", ["run", "check"]],
  ["build", "npm", ["run", "build"]],
  ["browser", "npm", ["run", "test:e2e"]],
  ["fail-closed", process.execPath, ["scripts/verify-production.mjs"]],
];
const directory = path.join(
  ".data",
  "release-check",
  new Date().toISOString().replace(/[:.]/g, "-"),
);
await mkdir(directory, { recursive: true, mode: 0o700 });
const results = [];
try {
  for (const [name, command, args] of steps) {
    console.log(`Checking ${name} with isolated mock data...`);
    const output = [];
    const code = await new Promise((resolve, reject) => {
      const child = spawn(command, args, {
        env: {
          ...env,
          NODE_ENV:
            name === "build" || name === "fail-closed"
              ? "production"
              : name === "browser"
                ? "development"
                : "test",
        },
        stdio: ["ignore", "pipe", "pipe"],
      });
      for (const stream of [child.stdout, child.stderr])
        stream.on("data", (data) => output.push(data));
      child.on("error", reject);
      child.on("close", resolve);
    });
    await writeFile(
      path.join(directory, `${name}.log`),
      Buffer.concat(output),
      { mode: 0o600 },
    );
    results.push({ step: name, passed: code === 0, exitCode: code });
    console.log(`${name}: ${code === 0 ? "PASS" : "FAIL"}`);
    if (code !== 0) {
      process.exitCode = 1;
      break;
    }
  }
} finally {
  await rm(store, { recursive: true, force: true });
  await writeFile(
    path.join(directory, "results.json"),
    JSON.stringify(
      {
        checkedAt: new Date().toISOString(),
        mockOnly: true,
        productionServiceAcceptance: false,
        results,
      },
      null,
      2,
    ),
    { mode: 0o600 },
  );
  console.log(`Evidence: ${directory}`);
  console.log(
    "Actual Supabase/Auth/Storage/SMTP/AI and authenticated Vercel PDF acceptance remain separate launch gates.",
  );
}
