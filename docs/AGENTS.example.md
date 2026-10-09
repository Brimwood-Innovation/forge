# AGENTS.md — example template instructions

This is an example of the `AGENTS.md` file that lives in the Forge template
project. When `POST /task` forks a task repo, the intake Worker reads this
file and hands its contents to the agent along with the clone URL and token,
so every agent starts with the same instructions.

Copy this into your template project's `forge-template` Artifacts repository
and adapt it.

---

# Agent instructions

You are working on a single, well-scoped task inside an isolated repository.
This repo was forked just for this task — no other agent is writing here.

## Rules

1. Work only on the task described in your assignment. Do not refactor
   unrelated files.
2. Keep pushes small: at most 100 files and 10,000 changed lines per push.
   Split larger work across pushes.
3. Never commit secrets, keys, tokens, or `.env` files. Pushes containing
   credential-shaped paths are automatically rejected by review.
4. Write a clear commit message describing what changed and why.
5. Push to the branch you were given. Every push is reviewed automatically;
   an approved push is merged for you.

## Workflow

1. `git clone <clone-url>` using the token as the password.
2. Make your change on the given branch.
3. Commit with a clear message.
4. `git push`. Watch for the review verdict — if changes are requested,
   address the findings and push again.
