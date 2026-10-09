/**
 * forge-review — review Worker.
 *
 * Consumes Artifacts push events (`cf.artifacts.repo.pushed`) from a queue.
 * For every push it builds a PushContext, runs the deterministic review
 * engine (workers/review/src/review.ts), logs a structured review record,
 * and merges on approval.
 *
 * Event subscription (one-time setup, after Workers Paid is active):
 * route the Artifacts namespace's push events to the "forge-review-events"
 * queue (Cloudflare dashboard → Notifications, or the API). The queue
 * consumer below does the rest.
 *
 * All code here is original to Brimwood Forge.
 */
import { reviewPush, type ChangedFile, type PushContext } from "./review";
import type { ArtifactsNamespace } from "../../../shared/artifacts";

export interface Env {
  /** Uncomment the [[artifacts]] block in wrangler.toml once Workers Paid is active. */
  ARTIFACTS: ArtifactsNamespace;
}

/** Shape of the Artifacts push event delivered to the queue. */
interface ArtifactsPushEvent {
  type: string;
  source: { namespace: string; repoName: string };
  payload: { ref: string; before?: string; after: string };
}

export type MergeOutcome =
  | { status: "merged"; detail: string }
  | { status: "conflict"; detail: string };

export default {
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    if (request.method === "GET" && url.pathname === "/health") {
      return Response.json({ ok: true, worker: "forge-review" });
    }
    return new Response("Not found", { status: 404 });
  },

  async queue(batch: MessageBatch<unknown>, env: Env): Promise<void> {
    for (const message of batch.messages) {
      const event = message.body as ArtifactsPushEvent;
      if (event?.type !== "cf.artifacts.repo.pushed") {
        message.ack();
        continue;
      }
      try {
        await handlePush(event, env);
      } catch (err) {
        // Log the failure, then rethrow so the queue retries (max_retries in wrangler.toml).
        console.error("forge review failed", {
          repo: event.source?.repoName,
          ref: event.payload?.ref,
          error: String(err),
        });
        throw err;
      }
      message.ack();
    }
  },
};

async function handlePush(event: ArtifactsPushEvent, env: Env): Promise<void> {
  const changedFiles = await collectChangedFiles(env, event);

  const ctx: PushContext = {
    namespace: event.source.namespace,
    repo: event.source.repoName,
    ref: event.payload.ref,
    before: event.payload.before ?? "",
    after: event.payload.after,
    changedFiles,
    // TODO (Workers Paid): read the commit message from commit metadata once
    // the beta API exposes it. reviewPush() treats an empty message as
    // "skipped", so reviews work either way.
    commitMessage: "",
  };

  const review = reviewPush(ctx);

  // The review record: tail this Worker's logs during the demo to watch
  // every decision land in real time.
  console.log(
    JSON.stringify({
      type: "forge.review",
      repo: ctx.repo,
      ref: ctx.ref,
      commit: ctx.after,
      verdict: review.verdict,
      summary: review.summary,
      findings: review.findings,
      checks: review.checks.map((c) => ({ name: c.name, passed: c.passed })),
    }),
  );

  if (review.verdict === "approve") {
    const outcome = await mergeTaskBranch(env, event);
    console.log(JSON.stringify({ type: "forge.merge", repo: ctx.repo, ...outcome }));
  }
}

/**
 * Build the changed-file list for a push.
 *
 * BLOCKED ON WORKERS PAID: the open-beta Artifacts binding documents
 * repo.readFile(), but commit-level diff listing is not yet confirmed against
 * a live namespace. Once Paid is active, implement this against the beta
 * diff API — or fall back to fetching the before/after refs over the git
 * protocol with a repo token and diffing locally.
 */
async function collectChangedFiles(
  _env: Env,
  event: ArtifactsPushEvent,
): Promise<ChangedFile[]> {
  void _env;
  throw new Error(
    `collectChangedFiles: not wired until Workers Paid is active (push to ${event.source.repoName}@${event.payload.ref}).`,
  );
}

/**
 * Merge an approved task branch back into the template project's default
 * branch.
 *
 * BLOCKED ON WORKERS PAID: confirm the beta merge API against a live
 * namespace. Expected behaviour: fast-forward when clean; on overlapping
 * edits return { status: "conflict" } with the conflicting paths so an agent
 * (or the demo operator) can resolve and push again — the next push
 * re-triggers review automatically.
 */
async function mergeTaskBranch(_env: Env, _event: ArtifactsPushEvent): Promise<MergeOutcome> {
  void _env;
  void _event;
  throw new Error("mergeTaskBranch: not wired until Workers Paid is active.");
}
