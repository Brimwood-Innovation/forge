# Forge

**The Git platform for the agentic era — built on Cloudflare Workers + Artifacts.**

GitHub was built for humans writing code. Agents work differently: hundreds of
them, concurrently, on the same codebase. Forge is the coordination layer —
every agent task gets its own isolated repository, and every push is reviewed
automatically before it merges.

Entry for the Cloudflare "build the next Git platform for AI agents" builder
competition (entries close Oct 14, 2026). Source is MIT-licensed; demo video
and run instructions below.

## How it works

```
  Agent task arrives
        │
        ▼
  ┌─────────────┐   fork per task     ┌──────────────────┐
  │ forge-intake │ ─────────────────▶ │  task-9f3c2a1b   │  Agent clones with
  │   Worker     │   scoped token +   │  (Artifacts repo) │  its scoped token,
  │ POST /task   │   AGENTS.md        └──────────────────┘  works, pushes
  └─────────────┘                              │
                                               │ push event
                                               ▼
                                      ┌──────────────────┐
                                      │  forge-review    │  review: secrets,
                                      │  Worker (queue)  │  size, ref hygiene
                                      └──────────────────┘  → approve → merge
                                                            → request-changes
```

1. **Intake** — `POST /task` with a description. The Worker forks the template
   project in Artifacts (`task-<id>`), reads the repo's `AGENTS.md` for
   instructions, and returns a clone URL plus a short-lived Git token scoped
   to that one repo. Agents can never collide: no shared branches, no merge
   queues.
2. **Work** — the agent clones with its token, commits, and pushes. The push
   publishes a `cf.artifacts.repo.pushed` event.
3. **Review** — the review Worker consumes push events from a queue, runs a
   deterministic review (secret-shaped paths, size budget, ref hygiene),
   logs a structured verdict, and merges on approval. Conflicts are reported
   with the colliding paths; resolving and pushing re-runs the pipeline.

Architectural inspiration: [gitorange](https://github.com/choyiny/gitorange)
(Apache-2.0) — Workers + D1 + Artifacts, short-lived repo-scoped tokens,
merges computed server-side. All code in this repo is original.

## Repository layout

```
forge/
├── workers/intake/      # Task-intake Worker (POST /task)
│   ├── wrangler.toml
│   └── src/index.ts
├── workers/review/      # Review Worker (queue consumer on push events)
│   ├── wrangler.toml
│   ├── src/index.ts     # queue → review → merge wiring
│   └── src/review.ts    # pure review engine (testable, no I/O)
├── shared/artifacts.ts  # Artifacts binding types (documented beta API)
├── scripts/smoke.mjs    # smoke tests for the review engine
├── docs/
│   ├── DEMO-SCRIPT.md   # 8–9 min demo video script outline
│   └── AGENTS.example.md# example template instructions handed to agents
└── README.md
```

## Status

Sprint scaffold, Oct 8, 2026. The intake Worker and the review engine are
written and typecheck; the review engine's pure logic is covered by
`npm run smoke`. **Runtime is blocked on Workers Paid activation**
(founder action in the Cloudflare dashboard): the Artifacts binding cannot
exist until then. The two marked TODOs in `workers/review/src/index.ts`
(`collectChangedFiles`, `mergeTaskBranch`) get wired against the live beta
API once the namespace exists.

## Prerequisites

- Node.js 20+
- A Cloudflare account with the **Workers Paid** plan ($5/month; includes
  10,000 Artifacts operations and 1 GB storage per month — a demo stays
  inside both, so the entry costs $5 flat). Artifacts is open beta and only
  available on Paid.
- `wrangler` (installed via `npm install`)

## Setup

```bash
git clone https://github.com/Brimwood-Innovation/forge.git
cd forge
npm install
```

1. Create the Artifacts namespace (after Workers Paid is active):

```bash
curl -X POST "https://api.cloudflare.com/client/v4/accounts/$ACCOUNT_ID/artifacts/namespaces" \
  -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
  --json '{"namespace":"forge"}'
```

2. Create the template project and push an `AGENTS.md` into it (see
   `docs/AGENTS.example.md`). The project name must match `PROJECT_NAME` in
   `workers/intake/wrangler.toml` (default: `forge-template`).

3. Create the review queue:

```bash
wrangler queues create forge-review-events
```

4. Uncomment the `[[artifacts]]` block in both `wrangler.toml` files.

5. Subscribe the namespace's push events to the queue (Cloudflare dashboard →
   Notifications, or the API) so `cf.artifacts.repo.pushed` reaches the
   review Worker.

6. Deploy (preview first; production only on explicit approval):

```bash
npm run deploy:intake -- --env preview
npm run deploy:review -- --env preview
```

No secrets are required: the intake Worker issues tokens at runtime and the
review Worker needs none. Never commit tokens or API keys.

## Try it

```bash
# 1. Create a task — you get a repo, a token, and instructions back.
curl -X POST https://forge-intake-preview.<account>.workers.dev/task \
  -H 'content-type: application/json' \
  -d '{"description":"Add a /greeting endpoint that returns hello"}'

# 2. Clone with the returned token (it is shown once — keep it secret).
git clone <cloneUrl>
cd task-<id>
# ... make a change, commit ...

# 3. Push. The review Worker picks it up automatically.
git push origin main

# 4. Watch the verdict land in real time.
wrangler tail forge-review-preview
```

A healthy run shows a `forge.review` record with `"verdict":"approve"` and a
`forge.merge` record with `"status":"merged"`. A push containing a
credential-shaped path (try adding a `.env` file) returns
`"verdict":"request-changes"` with findings — nothing merges.

## Competition entry checklist

- [x] Source under a permissive licence (MIT — see LICENSE)
- [x] Run / try instructions (this README)
- [ ] 5–10 minute demo video (script outline in `docs/DEMO-SCRIPT.md`;
      record after Workers Paid is active and the TODOs are wired)

## Roadmap (to Oct 14)

1. Workers Paid activation (founder, dashboard).
2. Wire `collectChangedFiles` + `mergeTaskBranch` against the live beta API.
3. Deploy preview, rehearse the demo script end-to-end once.
4. Record the video, submit.

## Licence

MIT — see [LICENSE](LICENSE).
