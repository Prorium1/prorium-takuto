import test from "node:test";
import assert from "node:assert/strict";
import { ownershipImportSchema } from "../src/lib/domain/ownership-import";
import { getOwnershipImport } from "../src/lib/server/ownership-import";
import { augustReport } from "../src/lib/mock/seed";

test("source imports require an admin and never imply a live connection in Mock", async () => {
  const old = process.env.PRORIUM_ENV;
  process.env.PRORIUM_ENV = "mock";
  try {
    await assert.rejects(
      getOwnershipImport({
        id: "mock-investor",
        companyId: "prorium",
        role: "investor",
      }),
      /管理者/,
    );
    const imported = await getOwnershipImport({
      id: "mock-admin",
      companyId: "prorium",
      role: "admin",
    });
    assert.ok(imported);
    assert.equal(
      await getOwnershipImport({
        id: "mock-other-admin",
        companyId: "other-company",
        role: "admin",
      }),
      null,
    );
    assert.match(imported.snapshot.sourceLabel, /架空.*未接続/);
    assert.equal(
      imported.snapshot.rows.reduce((n, r) => n + r.shares, 0),
      imported.snapshot.issuedShares,
    );
  } finally {
    if (old === undefined) delete process.env.PRORIUM_ENV;
    else process.env.PRORIUM_ENV = old;
  }
});

test("import metadata and snapshot validation reject extra fields, invalid dates and mismatched totals", () => {
  const input = {
    snapshot: augustReport.content.ownership,
    retrievedAt: "2026-09-05T10:30:00+09:00",
  };
  assert.equal(ownershipImportSchema.safeParse(input).success, true);
  assert.equal(
    ownershipImportSchema.safeParse({ ...input, token: "PRIVATE-CANARY" })
      .success,
    false,
  );
  assert.equal(
    ownershipImportSchema.safeParse({ ...input, retrievedAt: "invalid" })
      .success,
    false,
  );
  assert.equal(
    ownershipImportSchema.safeParse({
      ...input,
      snapshot: { ...input.snapshot, issuedShares: 1001 },
    }).success,
    false,
  );
});
