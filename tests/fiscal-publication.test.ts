import test from "node:test";
import assert from "node:assert/strict";
import {
  investorFiscalSource,
  organizationSchema,
  fiscalPublicationContentSchema,
  emptyFiscalEditor,
  fiscalReviewIssues,
  type FiscalPublication,
} from "../src/lib/domain/fiscal-publication";
import { mockFiscalSource } from "../src/lib/mock/fiscal";
import { augustReport } from "../src/lib/mock/seed";
import { latestPublishedOwnership } from "../src/lib/domain/ownership";
test("investor projection removes every internal evidence URL without changing financial values or source input", () => {
  const source = mockFiscalSource(2026),
    original = structuredClone(source);
  source.outlook!.sourceUrl = "https://private.example.test/secret";
  const result = investorFiscalSource(source);
  assert.equal(result.outlook?.sourceUrl, null);
  assert.equal(result.managementSummary?.schoolLaunches.sourceUrl, null);
  assert.ok(
    result.managementSummary?.schoolLaunches.confirmed.every(
      (x) => x.sourceUrl === null,
    ),
  );
  assert.deepEqual(result.months, original.months);
  assert.equal(
    source.outlook?.sourceUrl,
    "https://private.example.test/secret",
  );
});
test("latest ownership compares annual and monthly evidence dates and respects withdrawal in revisions", () => {
  const monthly = structuredClone(augustReport),
    source = investorFiscalSource(mockFiscalSource(2026));
  const annual: FiscalPublication = {
    id: "mock-annual",
    companyId: monthly.companyId,
    year: 2026,
    version: 1,
    revision: 1,
    state: "published",
    content: {
      ...emptyFiscalEditor(source.asOf),
      source,
      ownership: { ...monthly.content.ownership!, asOf: "2026-10-01" },
      video: null,
    },
    contentHash: "mock",
    approvedHash: "mock",
    publishedAt: "2026-10-23T00:00:00Z",
  };
  assert.match(
    latestPublishedOwnership([monthly], [annual])!.href,
    /^\/fiscal\//,
  );
  const withdrawn = structuredClone(annual);
  withdrawn.version = 2;
  withdrawn.content.ownership = null;
  assert.match(
    latestPublishedOwnership([monthly], [annual, withdrawn])!.href,
    /^\/reports\//,
  );
  withdrawn.state = "draft";
  assert.match(
    latestPublishedOwnership([monthly], [annual, withdrawn])!.href,
    /^\/fiscal\//,
  );
  monthly.content.ownership!.asOf = "2026-10-15";
  assert.match(
    latestPublishedOwnership([monthly], [annual])!.href,
    /^\/reports\//,
  );
});
test("unknown staff groups stay null and leave is an employee subset, never additional headcount", () => {
  const org = emptyFiscalEditor("2026-10-23").organization;
  assert.equal(
    organizationSchema.parse({ ...org, employees: 8, onLeave: 2 }).partTime,
    null,
  );
  assert.equal(
    organizationSchema.safeParse({ ...org, employees: 1, onLeave: 2 }).success,
    false,
  );
  assert.equal(
    organizationSchema.safeParse({ ...org, employees: -1 }).success,
    false,
  );
});
test("review readiness requires confirmed employees, commentary and risk disclosure; private links cannot be saved", () => {
  const source = mockFiscalSource(2026),
    editor = emptyFiscalEditor(source.asOf);
  assert.equal(
    fiscalPublicationContentSchema.safeParse({
      ...editor,
      source,
      ownership: null,
      video: null,
    }).success,
    false,
  );
  const content = fiscalPublicationContentSchema.parse({
    ...editor,
    source: investorFiscalSource(source),
    ownership: null,
    video: null,
  });
  assert.equal(fiscalReviewIssues(content).length, 2);
  content.organization = {
    ...content.organization,
    employees: 8,
    onLeave: 2,
    confirmed: true,
  };
  content.notes.risks = "Mock:未締め月を含む参考値です。";
  assert.deepEqual(fiscalReviewIssues(content), []);
});
