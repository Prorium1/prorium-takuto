import test from "node:test";
import assert from "node:assert/strict";
import { loginEmailError } from "../src/lib/domain/login-error";

test("email rate limit tells the user to pause instead of retrying repeatedly", () => {
  assert.match(loginEmailError({ status: 429 }), /送信回数の上限/);
  assert.match(loginEmailError({ status: 429 }), /時間をおいて/);
});

test("other email delivery errors do not claim a rate limit", () => {
  assert.doesNotMatch(loginEmailError({ status: 500 }), /送信回数の上限/);
});
