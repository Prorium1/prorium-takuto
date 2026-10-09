import { readFile, readdir } from "node:fs/promises";
import path from "node:path";

// These initial migrations are applied to the dedicated IR project.
// Keep this script read-only; any change requires a NEW migration.
const pairs = [
  ["database/schema.sql", "prorium_report_baseline"],
  ["database/production.sql", "prorium_production_monthly_ir"],
];
const directory = "supabase/migrations";
if (!process.argv.includes("--check"))
  throw new Error("Initial migrations are already applied. Create a new migration for changes.");
const files = await readdir(directory);
for (const [source, name] of pairs) {
  const matches = files.filter((file) => file.endsWith(`_${name}.sql`));
  if (matches.length !== 1)
    throw new Error(
      `Create exactly one ${name} migration with Supabase CLI first.`,
    );
  const destination = path.join(directory, matches[0]);
  const sql =
    `-- Initial schema source: ${source}\n` +
    (await readFile(source, "utf8"))
      .replace(/^begin;\s*$/gm, "")
      .replace(/^commit;\s*$/gm, "");
  if ((await readFile(destination, "utf8")) !== sql)
    throw new Error(`Applied migration differs from reviewed source: ${destination}`);
  console.log(`Verified: ${destination}`);
}
