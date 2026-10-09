/**
 * Forge review engine — pure, deterministic review logic.
 *
 * Takes a description of what was pushed and returns a structured review:
 * a diff summary, per-check results, findings, and a verdict of
 * "approve" or "request-changes". No I/O, no AI calls, no Artifacts
 * dependency, so this module is unit-testable anywhere (see scripts/smoke.mjs).
 *
 * In the running system, workers/review/src/index.ts builds the PushContext
 * from `cf.artifacts.repo.pushed` events and the Artifacts binding, then
 * hands it here. Merging on approval is handled there too.
 *
 * All code here is original to Brimwood Forge.
 */

export interface ChangedFile {
  path: string;
  additions: number;
  deletions: number;
}

export interface PushContext {
  namespace: string;
  repo: string;
  /** Full ref, e.g. "refs/heads/task-9f3c2a1b". */
  ref: string;
  before: string;
  after: string;
  changedFiles: ChangedFile[];
  /** May be empty when commit metadata is unavailable. */
  commitMessage: string;
}

export interface CheckResult {
  name: string;
  passed: boolean;
  detail: string;
}

export type Verdict = "approve" | "request-changes";

export interface Review {
  verdict: Verdict;
  summary: string;
  findings: string[];
  checks: CheckResult[];
}

/** Paths that must never arrive in an agent push. */
const SECRET_PATH_PATTERN =
  /(\.pem$|\.key$|id_rsa|id_ed25519|\.env$|credentials\.json$|secrets\.ya?ml$)/i;

/** Guardrails keep a single review cheap and readable. */
const MAX_FILES_PER_PUSH = 100;
const MAX_LINE_DELTA_PER_PUSH = 10_000;

export function reviewPush(ctx: PushContext): Review {
  const checks: CheckResult[] = [];
  const findings: string[] = [];

  const branch = ctx.ref.replace(/^refs\/heads\//, "");

  // 1. Ref hygiene: we only review branch pushes, never tag or ref deletes.
  if (!ctx.ref.startsWith("refs/heads/")) {
    checks.push({
      name: "ref-hygiene",
      passed: false,
      detail: `Expected a branch push, got ref "${ctx.ref}".`,
    });
    findings.push(`Ignoring non-branch ref "${ctx.ref}".`);
  } else {
    checks.push({ name: "ref-hygiene", passed: true, detail: `Branch push to "${branch}".` });
  }

  // 2. No secrets: agent pushes must never contain credential-shaped paths.
  const secretFiles = ctx.changedFiles
    .map((f) => f.path)
    .filter((p) => SECRET_PATH_PATTERN.test(p));
  if (secretFiles.length > 0) {
    checks.push({
      name: "no-secrets",
      passed: false,
      detail: `Credential-shaped paths: ${secretFiles.join(", ")}.`,
    });
    findings.push(
      `Push contains ${secretFiles.length} credential-shaped path(s): ${secretFiles.join(", ")}. ` +
        "Remove them and push again.",
    );
  } else {
    checks.push({ name: "no-secrets", passed: true, detail: "No credential-shaped paths." });
  }

  // 3. Size budget: keep reviews small enough to actually read.
  const totalDelta = ctx.changedFiles.reduce((n, f) => n + f.additions + f.deletions, 0);
  if (ctx.changedFiles.length > MAX_FILES_PER_PUSH || totalDelta > MAX_LINE_DELTA_PER_PUSH) {
    checks.push({
      name: "size-budget",
      passed: false,
      detail:
        `${ctx.changedFiles.length} files, ${totalDelta} changed lines ` +
        `(limits: ${MAX_FILES_PER_PUSH} files, ${MAX_LINE_DELTA_PER_PUSH} lines).`,
    });
    findings.push("Push exceeds the review size budget — split it into smaller pushes.");
  } else {
    checks.push({
      name: "size-budget",
      passed: true,
      detail: `${ctx.changedFiles.length} files, ${totalDelta} changed lines.`,
    });
  }

  // 4. Commit message: present when the platform supplies metadata.
  // (The beta API does not expose it yet; an absent message is skipped,
  // not failed, so reviews stay usable during the beta.)
  if (ctx.commitMessage.trim()) {
    checks.push({ name: "commit-message", passed: true, detail: "Commit message present." });
  } else {
    checks.push({
      name: "commit-message",
      passed: true,
      detail: "Commit metadata not available from the beta API — skipped.",
    });
  }

  const verdict: Verdict = checks.every((c) => c.passed) ? "approve" : "request-changes";

  const additions = ctx.changedFiles.reduce((n, f) => n + f.additions, 0);
  const deletions = ctx.changedFiles.reduce((n, f) => n + f.deletions, 0);
  const summary =
    `${ctx.changedFiles.length} file(s) changed (+${additions}/-${deletions}) ` +
    `on ${branch} in ${ctx.repo} — ${verdict === "approve" ? "all checks passed" : "changes requested"}.`;

  return { verdict, summary, findings, checks };
}
