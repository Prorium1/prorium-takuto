import test from "node:test";
import assert from "node:assert/strict";
import {
  credentialInput,
  generateInvestorPassword,
  issueInvestorCredentials,
  type CredentialDependencies,
} from "../supabase/functions/ir-investor-credentials/core";
import {
  investorInvitationText,
  investorCredentialError,
} from "../src/lib/domain/investor-credentials";

const companyId = "11111111-1111-1111-1111-111111111111",
  actorId = "22222222-2222-2222-2222-222222222222",
  userId = "33333333-3333-3333-3333-333333333333",
  requestId = "44444444-4444-4444-4444-444444444444";
const input = {
  companyId,
  email: "investor@example.test",
  mode: "create",
  acknowledged: false,
};
function fixture() {
  const calls: string[] = [];
  const deps: CredentialDependencies = {
    async authorize() {
      calls.push("authorize");
      return { id: actorId, companyId, role: "admin" };
    },
    async reserve(i) {
      calls.push("reserve");
      return { requestId, email: i.email, targetUserId: null };
    },
    async create(email, password, company) {
      calls.push("create");
      assert.equal(company, companyId);
      assert.equal(password.length, 23);
      return { id: userId, email };
    },
    async update(id, email, password) {
      calls.push("update");
      assert.equal(id, userId);
      assert.equal(password.length, 23);
      return { id, email };
    },
    async complete(i, request, actor, user) {
      calls.push("complete");
      assert.equal(i.email, input.email);
      assert.equal(request, requestId);
      assert.equal(actor, actorId);
      assert.equal(user, userId);
      return true;
    },
  };
  return { deps, calls };
}
test("generated passwords are distinct, unambiguous and meet upper/lower/digit/symbol requirements", () => {
  const values = Array.from({ length: 500 }, generateInvestorPassword);
  assert.equal(new Set(values).size, 500);
  for (const value of values) {
    assert.match(
      value,
      /^[A-HJ-NP-Za-km-z2-9]{5}(?:-[A-HJ-NP-Za-km-z2-9]{5}){3}$/,
    );
    assert.match(value, /[A-Z]/);
    assert.match(value, /[a-z]/);
    assert.match(value, /[2-9]/);
  }
});
test("only a current admin of the requested company can issue a credential", async () => {
  for (const actor of [
    null,
    { id: actorId, companyId, role: "investor" },
    { id: actorId, companyId: requestId, role: "admin" },
  ]) {
    const { deps, calls } = fixture();
    deps.authorize = async () => actor;
    await assert.rejects(issueInvestorCredentials(input, deps), /denied/);
    assert.deepEqual(calls, []);
  }
  for (const value of [
    { ...input, email: "x" },
    { ...input, mode: "reset" },
    { ...input, userId },
    { ...input, companyId: "not-an-id" },
  ])
    assert.throws(() => credentialInput(value), /invalid/);
  assert.equal(
    credentialInput({ ...input, email: " Investor@example.test " }).email,
    input.email,
  );
});
test("new accounts return a password only after the bounded operation is recorded", async () => {
  const { deps, calls } = fixture();
  const result = await issueInvestorCredentials(input, deps);
  assert.deepEqual(calls, ["authorize", "reserve", "create", "complete"]);
  assert.deepEqual(Object.keys(result).sort(), ["email", "password"]);
  assert.equal(result.email, input.email);
});
test("reissue updates only the reserved identity and requires explicit acknowledgement", async () => {
  const { deps, calls } = fixture();
  deps.reserve = async () => ({
    requestId,
    email: input.email,
    targetUserId: userId,
  });
  await assert.rejects(
    issueInvestorCredentials({ ...input, mode: "reset" }, deps),
    /invalid/,
  );
  await assert.rejects(
    issueInvestorCredentials({ ...input, acknowledged: true }, deps),
    /denied/,
  );
  calls.length = 0;
  await issueInvestorCredentials(
    { ...input, mode: "reset", acknowledged: true },
    deps,
  );
  assert.deepEqual(calls, ["authorize", "update", "complete"]);
});
test("backend errors and mismatched identities never report a usable credential", async () => {
  for (const failure of ["reserve", "create", "complete"] as const) {
    const { deps, calls } = fixture();
    deps[failure] = async () => {
      throw Error("backend unavailable");
    };
    await assert.rejects(
      issueInvestorCredentials(input, deps),
      /backend unavailable/,
    );
    if (failure !== "complete") assert.ok(!calls.includes("complete"));
  }
  const { deps } = fixture();
  deps.create = async () => ({ id: userId, email: "different@example.test" });
  await assert.rejects(
    issueInvestorCredentials(input, deps),
    /identity-changed/,
  );
  deps.create = async () => ({ id: userId, email: input.email });
  deps.complete = async () => false;
  await assert.rejects(issueInvestorCredentials(input, deps), /unavailable/);
});
test("shareable invitation uses a clean login URL and safe error messages", () => {
  const password = generateInvestorPassword(),
    loginUrl = "https://ir.example.test/login";
  const text = investorInvitationText({
    email: input.email,
    password,
    loginUrl,
  });
  assert.ok(text.includes(`ログインURL：${loginUrl}\n`));
  assert.ok(text.includes(`パスワード：${password}`));
  assert.ok(!text.includes(`?password=`));
  assert.ok(
    !investorCredentialError("sensitive upstream response").includes(
      "sensitive",
    ),
  );
});
