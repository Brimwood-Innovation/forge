/**
 * Minimal TypeScript surface for the Cloudflare Artifacts binding, based on
 * the documented open-beta API (Workers + Artifacts announcement, Oct 2026).
 *
 * ACTIVATION NOTE
 * --------------
 * The Artifacts binding only runs on the Workers Paid plan. Until Paid is
 * active on the account and the namespace exists, every call below fails at
 * runtime. The code is written and ready: to wire it up, uncomment the
 * [[artifacts]] block in each worker's wrangler.toml and create the
 * namespace (see README "Setup"). Nothing else in this repo changes.
 *
 * All code here is original to Brimwood Forge.
 */

/** A workspace handed back when a project is forked for an agent task. */
export interface TaskWorkspace {
  /** Repository name, e.g. "task-9f3c2a1b". */
  name: string;
  /** Git remote URL the agent clones, e.g. "https://...git". */
  remote: string;
  /** Short-lived Git token scoped to this one repository. Treat as secret. */
  token: string;
}

/** A file handle returned by repo.readFile(). */
export interface ArtifactsFile {
  text(): Promise<string>;
}

/**
 * Handle for either a project or a single repository inside an Artifacts
 * namespace. Mirrors the documented beta calls:
 *   const project = await env.ARTIFACTS.get("my-project");
 *   const workspace = await project.fork("task-<id>");
 *   const repo = await env.ARTIFACTS.get(workspace.name);
 *   const file = await repo.readFile({ ref, path });
 */
export interface ArtifactsHandle {
  info(): Promise<{ defaultBranch: string }>;
  fork(name: string): Promise<TaskWorkspace>;
  readFile(opts: { ref: string; path: string }): Promise<ArtifactsFile | null>;
}

/** The `env.ARTIFACTS` namespace binding. */
export interface ArtifactsNamespace {
  get(name: string): Promise<ArtifactsHandle>;
}
