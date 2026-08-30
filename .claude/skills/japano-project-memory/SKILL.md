---
name: japano-project-memory
description: Resume work in the JAPANO monorepo without re-auditing the whole repository. Use at the start of broad JAPANO implementation, debugging, release, AI, Android, Admin, database, ERD, or handoff tasks, and after material changes that must be remembered by later Codex or Claude Code sessions.
---

# JAPANO Project Memory

1. Read `docs/CODEX_PROJECT_MEMORY.md` before exploring the repository broadly.
2. Confirm the current branch and inspect the relevant dirty diff. Preserve
   concurrent-agent changes and do not reset, stash, clean, switch branches,
   commit, or push without an explicit user request.
3. Use the memory document as an index. Open only the source, tests and evidence
   needed for the present task; source and runtime output remain authoritative.
4. Before handoff, update `docs/CODEX_PROJECT_MEMORY.md` for any material code,
   runtime, URL, model, benchmark, device-delivery, blocker or next-step change.
5. Also update `README.md` when setup, commands, product behavior, limitations or
   validated metrics changed. Do not add transient logs, secrets or speculation.
6. Apply the truth rules in the memory document: distinguish inference tuning
   from fine-tuning, avoid fabricated body measurements, and label tests that
   were not verified on a real device.
