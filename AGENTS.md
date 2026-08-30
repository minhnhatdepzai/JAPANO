# JAPANO agent instructions

These rules apply to the whole repository.

1. Before a broad audit or implementation task, read
   `docs/CODEX_PROJECT_MEMORY.md`. Use it as the navigation index, then open
   only the source files needed for the current task.
2. This repository is often edited by Codex and Claude Code at the same time.
   Preserve unrelated dirty changes. Never reset, clean, stash, switch branches,
   commit, or push unless the user explicitly asks.
3. After a material code, architecture, runtime, model, benchmark, URL, or
   device-delivery change, update `docs/CODEX_PROJECT_MEMORY.md`. Update
   `README.md` when the user-facing feature, setup, command, limitation, or
   validated benchmark changed.
4. Do not call inference/prompt/calibration changes “fine-tuning”. A fine-tune
   claim requires licensed training data, optimizer updates, a reloadable
   checkpoint/adapter with hash, and held-out evaluation evidence.
5. One uncontrolled photo cannot establish exact height, weight, or body
   circumferences. Return an explicit insufficient-evidence state instead of
   fabricated numbers. Manual measurements and reference-object captures take
   precedence.
6. Body measurement and virtual try-on are separate capabilities. A missing
   measurement must not silently become a generated measurement or a fake
   image-overlay fallback. Keep age/category safety checks intact.
7. Validate visible mobile/device flows where possible. Typecheck, HTTP 200,
   or an APK build alone is partial evidence; state when OPPO/device validation
   was not performed.

<!-- gitnexus:start -->
# GitNexus — Code Intelligence

This project is indexed by GitNexus as **JAPANO** (10434 symbols, 27057 relationships, 611 execution flows).

> Index stale? Run `node .gitnexus/run.cjs analyze --index-only` from the project root — it auto-selects an available runner. No `.gitnexus/run.cjs` yet? Bootstrap with `npx`, `bunx`, or `pnpm dlx` — e.g. `bunx gitnexus@latest analyze` (npm 11 npx crash; #1939).

## Always Do

- **MUST run impact analysis before editing.** Use `impact({target: "symbolName", direction: "upstream"})` (MCP) or `node .gitnexus/run.cjs impact "symbolName" --direction upstream --repo .` (CLI fallback); report callers, processes, and risk. Never substitute grep for graph analysis.
- **MUST analyze graph changes before committing.** Use `detect_changes({scope: "all"})` (MCP) or `node .gitnexus/run.cjs detect-changes --scope all --repo .` (CLI fallback). `partial: true` or `truncated: true` is not a clean check — a zero means unseen, not unaffected; re-run it. For regression review: `detect_changes({scope: "compare", base_ref: "main"})` or `node .gitnexus/run.cjs detect-changes --scope compare --base-ref "main" --repo .`.
- **MUST warn the user** if impact analysis returns HIGH or CRITICAL risk before proceeding with edits.
- **MUST treat `risk: UNKNOWN` as unresolved, not as low.** An empty caller set is not evidence the symbol is unused — it can also mean the callers are not resolvable by the index (plain-object property access, dynamic dispatch, cross-language calls). `impact` pairs `UNKNOWN` with a `riskNote` saying so. Confirm with a text search before treating the symbol as safe to change or delete; do not proceed on the strength of a zero.
- When exploring unfamiliar code, use `query({search_query: "concept"})` to find execution flows instead of grepping. It returns process-grouped results ranked by relevance.
- When you need full context on a specific symbol — callers, callees, which execution flows it participates in — use `context({name: "symbolName"})`.
- For security review, `explain({target: "fileOrSymbol"})` lists taint findings (source→sink flows; needs `analyze --pdg`).

## Never Do

- NEVER edit a function, class, or method before MCP/CLI impact analysis.
- NEVER ignore HIGH or CRITICAL risk warnings from impact analysis, and never read `UNKNOWN` as an all-clear — it means the walk could not answer, which is the one verdict that requires confirming by other means.
- NEVER rename symbols with find-and-replace — use `rename` which understands the call graph.
- NEVER commit before MCP/CLI graph change analysis.

## Resources

| Resource | Use for |
| --- | --- |
| `gitnexus://repo/JAPANO/context` | Codebase overview, check index freshness |
| `gitnexus://repo/JAPANO/clusters` | All functional areas |
| `gitnexus://repo/JAPANO/processes` | All execution flows |
| `gitnexus://repo/JAPANO/process/{name}` | Step-by-step execution trace |

## CLI

| Task | Read this skill file |
| --- | --- |
| Understand architecture / "How does X work?" | `.claude/skills/gitnexus-exploring/SKILL.md` |
| Blast radius / "What breaks if I change X?" | `.claude/skills/gitnexus-impact-analysis/SKILL.md` |
| Trace bugs / "Why is X failing?" | `.claude/skills/gitnexus-debugging/SKILL.md` |
| Rename / extract / split / refactor | `.claude/skills/gitnexus-refactoring/SKILL.md` |
| Tools, resources, schema reference | `.claude/skills/gitnexus-guide/SKILL.md` |
| Index, status, clean, wiki CLI commands | `.claude/skills/gitnexus-cli/SKILL.md` |

<!-- gitnexus:end -->
