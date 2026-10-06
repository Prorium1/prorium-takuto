import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";

const email = z
  .email()
  .max(254)
  .parse(process.env.PRORIUM_INITIAL_ADMIN_EMAIL)
  .trim()
  .toLowerCase();
const companyId = process.env.PRORIUM_COMPANY_ID
  ? z.uuid().parse(process.env.PRORIUM_COMPANY_ID)
  : randomUUID();
const output = path.resolve(".data/production-bootstrap.sql");
const sql = `-- Apply ONLY to the new, dedicated production IR project after both migrations.\n-- No accounts, passwords or financial data are seeded.\nbegin;\ninsert into public.companies(id,name) values ('${companyId}','株式会社Prorium') on conflict(id) do nothing;\ninsert into private.ir_invitations(company_id,email,role,active) values ('${companyId}','${email.replaceAll("'", "''")}','admin',true) on conflict(company_id,email) do nothing;\ncommit;\n`;
await mkdir(path.dirname(output), { recursive: true });
await writeFile(output, sql, { mode: 0o600, flag: "wx" });
console.log(
  `Prepared ${output}\nPRORIUM_COMPANY_ID=${companyId}\nReview the SQL before applying. This command did not access any database.`,
);
