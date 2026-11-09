import test from "node:test";
import assert from "node:assert/strict";
import { loginDestination } from "../src/lib/domain/login-access";

test("verified owners and invited investors enter their own workspace", () => {
  assert.equal(
    loginDestination(
      { id: "owner", companyId: "company", role: "admin" },
      "owner",
      "company",
    ),
    "/admin",
  );
  assert.equal(
    loginDestination(
      { id: "investor", companyId: "company", role: "investor" },
      "investor",
      "company",
    ),
    "/dashboard",
  );
});

test("Google authentication alone, another identity or company cannot grant report access", () => {
  for (const actor of [
    null,
    {},
    { id: "someone-else", companyId: "company", role: "admin" },
    { id: "user", companyId: "other-company", role: "admin" },
    { id: "user", companyId: "company", role: "owner" },
    { email: "user@example.test", role: "admin" },
  ]) {
    assert.equal(loginDestination(actor, "user", "company"), null);
  }
});
