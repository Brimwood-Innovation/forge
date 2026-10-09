// Smoke test for the Forge review engine (pure logic, no Artifacts needed).
// Run: npm run smoke   (typechecks, compiles review.ts, runs these tests)
import test from "node:test";
import assert from "node:assert/strict";
import { reviewPush } from "../.smoke-dist/workers/review/src/review.js";

const base = {
  namespace: "forge",
  repo: "task-9f3c2a1b",
  ref: "refs/heads/task-9f3c2a1b",
  before: "aaa111",
  after: "bbb222",
  commitMessage: "Add greeting endpoint",
};

test("clean push is approved", () => {
  const review = reviewPush({
    ...base,
    changedFiles: [{ path: "src/hello.ts", additions: 40, deletions: 5 }],
  });
  assert.equal(review.verdict, "approve");
  assert.equal(review.findings.length, 0);
  assert.ok(review.checks.every((c) => c.passed));
  assert.match(review.summary, /1 file\(s\) changed \(\+40\/-5\)/);
});

test("credential-shaped path requests changes", () => {
  const review = reviewPush({
    ...base,
    changedFiles: [
      { path: "src/hello.ts", additions: 10, deletions: 0 },
      { path: "config/.env", additions: 3, deletions: 0 },
    ],
  });
  assert.equal(review.verdict, "request-changes");
  const check = review.checks.find((c) => c.name === "no-secrets");
  assert.equal(check.passed, false);
  assert.ok(review.findings.some((f) => f.includes("config/.env")));
});

test("oversized push requests changes", () => {
  const files = Array.from({ length: 101 }, (_, i) => ({
    path: `src/file${i}.ts`,
    additions: 1,
    deletions: 0,
  }));
  const review = reviewPush({ ...base, changedFiles: files });
  assert.equal(review.verdict, "request-changes");
  assert.equal(review.checks.find((c) => c.name === "size-budget").passed, false);
});

test("non-branch ref is rejected", () => {
  const review = reviewPush({ ...base, ref: "refs/tags/v1.0.0", changedFiles: [] });
  assert.equal(review.verdict, "request-changes");
  assert.equal(review.checks.find((c) => c.name === "ref-hygiene").passed, false);
});

test("missing commit message is skipped, not failed", () => {
  const review = reviewPush({
    ...base,
    commitMessage: "",
    changedFiles: [{ path: "src/hello.ts", additions: 1, deletions: 0 }],
  });
  assert.equal(review.verdict, "approve");
  assert.equal(review.checks.find((c) => c.name === "commit-message").detail.includes("skipped"), true);
});
