import assert from "node:assert/strict";
import { test } from "node:test";
import { detectSecrets, validateSdd } from "./repo-gates.mjs";

test("code changes require a spec", () => {
  assert.throws(() => validateSdd(["src/application/handler.ts"]));
  assert.doesNotThrow(() =>
    validateSdd(["src/application/handler.ts", "specs/features/0002/spec.md"]),
  );
});

test("secret detection checks staged text without rejecting example values", () => {
  const token = "gh" + "p_" + "A".repeat(32);
  assert.deepEqual(detectSecrets(token), ["GitHub token"]);
  assert.deepEqual(detectSecrets("API_KEY=local-development-example"), []);
});
