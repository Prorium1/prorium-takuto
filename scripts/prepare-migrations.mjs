import { readFile, writeFile, readdir } from "node:fs/promises";
import path from "node:path";

// Only for these initial, unapplied CLI-generated migrations. Once deployed,
// changes require a NEW `supabase migration new ...` migration.
const pairs = [
  ["database/schema.sql", "prorium_report_baseline"],
  ["database/production.sql", "prorium_production_monthly_ir"],
];
const directory = "supabase/migrations";
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
  if (process.argv.includes("--check")) {
    if ((await readFile(destination, "utf8")) !== sql)
      throw new Error(
        `Unapplied migration differs from reviewed source: ${destination}`,
      );
  } else await writeFile(destination, sql);
  console.log(
    `${process.argv.includes("--check") ? "Verified" : "Prepared"}: ${destination}`,
  );
}
