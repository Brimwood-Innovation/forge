/**
 * forge-intake — task-intake Worker.
 *
 * POST /task accepts a task description, forks an Artifacts repository for
 * the task, reads the repo's AGENTS.md for agent instructions, and issues a
 * short-lived Git token scoped to that one repository. The response is
 * everything an agent needs to start working: clone URL, token, base branch,
 * and instructions.
 *
 * Pushes to the task repo publish `cf.artifacts.repo.pushed` events, which
 * the forge-review Worker consumes to review and merge. See
 * workers/review/src/index.ts.
 *
 * All code here is original to Brimwood Forge.
 */
import type { ArtifactsNamespace } from "../../../shared/artifacts";

export interface Env {
  /** Uncomment the [[artifacts]] block in wrangler.toml once Workers Paid is active. */
  ARTIFACTS: ArtifactsNamespace;
  /** Non-secret config: Artifacts project that task repos fork from. */
  PROJECT_NAME: string;
}

interface TaskRequest {
  /** What the agent should do. Plain text, max 2000 chars. */
  description?: string;
}

interface TaskResponse {
  taskId: string;
  /** Artifacts repository name, e.g. "task-9f3c2a1b". */
  repo: string;
  /** Git remote the agent clones. */
  cloneUrl: string;
  /** Repo-scoped Git token. Returned once — treat as secret, never log it. */
  token: string;
  baseBranch: string;
  /** Contents of the repo's AGENTS.md, or null when absent. */
  instructions: string | null;
}

const MAX_DESCRIPTION_LENGTH = 2000;

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (request.method === "GET" && url.pathname === "/health") {
      return Response.json({ ok: true, worker: "forge-intake" });
    }

    if (request.method === "POST" && url.pathname === "/task") {
      return handleCreateTask(request, env);
    }

    return new Response("Not found", { status: 404 });
  },
};

async function handleCreateTask(request: Request, env: Env): Promise<Response> {
  let body: TaskRequest;
  try {
    body = (await request.json()) as TaskRequest;
  } catch {
    return jsonError("Request body must be JSON.", 400);
  }

  const description = (body.description ?? "").trim();
  if (!description) {
    return jsonError('Missing required field: "description".', 400);
  }
  if (description.length > MAX_DESCRIPTION_LENGTH) {
    return jsonError(
      `"description" must be ${MAX_DESCRIPTION_LENGTH} characters or fewer.`,
      400,
    );
  }

  // Forking needs the Artifacts binding, which only exists on Workers Paid.
  if (!env.ARTIFACTS) {
    return jsonError(
      "Artifacts binding is not configured. Activate Workers Paid, create the " +
        "namespace, and uncomment the [[artifacts]] block in wrangler.toml.",
      503,
    );
  }

  try {
    const taskId = crypto.randomUUID();
    const repoName = `task-${taskId.slice(0, 8)}`;

    const project = await env.ARTIFACTS.get(env.PROJECT_NAME);
    const { defaultBranch } = await project.info();

    // One isolated repo per task: agents can never collide on branches.
    const workspace = await project.fork(repoName);

    // Hand the agent the repo's own instructions, when the template has them.
    const repo = await env.ARTIFACTS.get(workspace.name);
    const agentsFile = await repo.readFile({ ref: defaultBranch, path: "AGENTS.md" });
    const instructions = agentsFile ? await agentsFile.text() : null;

    const response: TaskResponse = {
      taskId,
      repo: workspace.name,
      cloneUrl: workspace.remote,
      token: workspace.token,
      baseBranch: defaultBranch,
      instructions,
    };

    // The token is returned exactly once: never cache or log this response.
    return new Response(JSON.stringify(response), {
      status: 201,
      headers: {
        "content-type": "application/json",
        "cache-control": "no-store",
      },
    });
  } catch (err) {
    console.error("task fork failed", { error: String(err) });
    return jsonError(
      "Could not fork a task repository. Confirm Workers Paid is active and " +
        "the Artifacts namespace exists.",
      502,
    );
  }
}

function jsonError(message: string, status: number): Response {
  return Response.json({ error: message }, { status });
}
