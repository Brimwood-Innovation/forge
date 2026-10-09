# Forge — demo video script outline

Target length: 8–9 minutes (competition requires 5–10). Record the terminal
and browser; narrate over it. Pre-stage the template project and the
`AGENTS.md` from `docs/AGENTS.example.md` before recording.

## 0:00–0:45 — Cold open

- On screen: the Forge README and the architecture diagram.
- Narration: "GitHub was built for humans. Agents work differently — hundreds
  of them, at once, on the same codebase. Forge is the coordination layer:
  every agent task gets its own repository, and every push gets reviewed
  automatically."
- State the stack: Cloudflare Workers + Artifacts, MIT-licensed source.

## 0:45–2:15 — Three tasks, three repos (concurrent intake)

- On screen: three `curl POST /task` calls, one after another, with three
  different task descriptions (e.g. "add a /greeting endpoint", "fix the
  off-by-one in pagination", "add request logging").
- Show each response: `repo`, `cloneUrl`, `token`, `instructions` (from
  AGENTS.md). Emphasise: one isolated repo per task, scoped token per repo —
  agents can never collide on branches.
- Narration: "No branches to coordinate, no merge queues. Each agent gets a
  whole repository."

## 2:15–3:15 — Agents start working

- On screen: Artifacts dashboard showing the three new `task-*` repos.
- Three terminal panes: `git clone <clone-url>` with the token as password,
  one per task. Show the AGENTS.md instructions the agent received.
- Narration: "Each agent clones with a token scoped to its own repo — it
  cannot see or touch the others."

## 3:15–4:45 — Three concurrent pushes

- On screen: the three agents make their changes and `git push`, roughly at
  the same time.
- Cut to the queue / dashboard: three `cf.artifacts.repo.pushed` events fire.
- Narration: "Every push publishes an event. Forge subscribes, and the
  review Worker picks each one up."

## 4:45–6:15 — Automated review, live

- On screen: `wrangler tail forge-review` (or dashboard logs). Three
  `forge.review` records arrive:
  - Task 1: `approve` — clean diff, all checks passed.
  - Task 2: `approve` — clean diff, all checks passed.
  - Task 3: `request-changes` — deliberately plant a `.env` file in this
    push beforehand so the `no-secrets` check fires on camera.
- Show the structured review: verdict, summary, findings, per-check results.
- Narration: "Deterministic checks first — secrets, size budget, ref hygiene.
  Task 3 tried to commit a `.env` file. Review caught it, asked for changes,
  nothing merged."

## 6:15–7:45 — Conflict, shown and resolved

- Setup (pre-record or live): tasks 1 and 2 both edited the same route file
  in a way that overlaps. Task 1 merged cleanly on approval; task 2's merge
  now conflicts.
- On screen: the `forge.merge` log shows `status: "conflict"` with the
  conflicting paths.
- An agent (or the operator) resolves the conflict locally, pushes again —
  the push re-triggers review automatically, review approves, merge lands.
- Narration: "Conflicts are data, not drama. The merge reports exactly what
  collided; resolving and pushing re-runs the whole pipeline."

## 7:45–8:30 — Merge and deploy

- On screen: the template project's history now shows the three task commits
  landed; optionally, a Workers Build deploys the merged result (if wired —
  otherwise show the merged log and note deployment is next).
- Narration: "Three agents, three repos, three reviews, three merges — no
  human in the loop until we wanted one."

## 8:30–9:00 — Outro

- On screen: repo URL, MIT licence, run instructions.
- Narration: "Forge is the Git platform for the agentic era: programmable
  repos, scoped tokens, and review as infrastructure. Source is MIT —
  link below."

## Shot list / checklist

- [ ] Template project `forge-template` created in Artifacts with AGENTS.md
- [ ] Both Workers deployed; queue created; push events subscribed
- [ ] Three task descriptions prepared; task 3's `.env` plant ready
- [ ] Conflict scenario rehearsed once end-to-end
- [ ] `wrangler tail` output readable at 1080p (increase font size)
- [ ] Captions / transcript prepared for upload
