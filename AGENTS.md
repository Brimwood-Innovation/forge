# AGENTS.md — Forge repository conventions

This repo is the Brimwood entry for the Cloudflare "build the next Git
platform for AI agents" builder competition (entries close Oct 14, 2026).

## Conventions for agents working here

- TypeScript, strict mode. Run `npm run typecheck` before committing.
- The review engine (`workers/review/src/review.ts`) is pure logic with no
  I/O — keep it that way so `npm run smoke` stays fast and hermetic.
- All Artifacts beta-API uncertainty lives behind clearly marked TODOs in
  `workers/review/src/index.ts` and `shared/artifacts.ts`. Do not invent
  API calls; confirm against a live namespace once Workers Paid is active.
- No secrets in the repo, ever. Tokens are issued at runtime by the intake
  Worker and returned once over HTTPS.
- Canadian spelling in docs and comments (behaviour, organisation, etc.).
- Production deploys only on the founder's explicit word. Preview
  environments are free to use.
