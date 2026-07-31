# Evidence: Git History Summary

Status: verified directly by attempting real git commands from the repository root. This file reports the actual result honestly rather than fabricating a plausible-looking commit history.

## Finding: no usable git history exists

```
$ cd /home/nhat/Downloads/japano && git log --oneline -20
fatal: not a git repository (or any of the parent directories): .git

$ git status
fatal: not a git repository (or any of the parent directories): .git

$ git -C /home/nhat/Downloads/japano status
fatal: not a git repository (or any of the parent directories): .git
```

A `.git/` directory does exist at the repo root (`drwxr-xr-x 3 nhat nhat 4096 Jul 22 11:48 .git`), but it is **not a valid, initialized git repository**:

```
$ ls -la .git/
total 12
drwxr-xr-x  3 nhat nhat 4096 Jul 22 11:48 .
drwxr-xr-x 14 nhat nhat 4096 Jul 24 17:46 ..
drwxrwxr-x  2 nhat nhat 4096 Jul 22 11:48 info

$ cat .git/HEAD
cat: .git/HEAD: No such file or directory
```

It contains only an `info/` subdirectory (populated with editor/tooling exclude patterns) — no `HEAD`, no `objects/`, no `refs/`, no `config`. Git correctly refuses to treat this as a repository, and every git command (`log`, `status`, `check-ignore`, etc.) fails with the same "not a git repository" error. This was independently re-confirmed by the security-analysis research pass (see `security-analysis.md` §5), which needed `git check-ignore -v .env.server` to confirm secrets weren't tracked and hit the identical failure.

## What this means for the thesis

- **There is no commit history to summarize, cite, or present as a development timeline.** Any chapter section describing "commit frequency," "development milestones by commit," or a "Git workflow" for this specific repository must either be omitted or explicitly state that no version-control history is available in the delivered repository, rather than inventing one.
- **Consequence for other evidence claims**: any statement elsewhere in this evidence pack (or in the thesis) about whether a file is tracked, ignored, or was ever committed (e.g., whether `.env.server` is actually excluded from version control) cannot be confirmed by git itself in this environment — only by manually reading `.gitignore`'s patterns and reasoning about standard glob semantics. This caveat is carried into `security-analysis.md` §5.
- If the team has a *separate*, properly-initialized copy of this repository elsewhere (e.g., on GitHub, or on another machine) with real commit history, that history is not available from the copy analyzed for this evidence pack and cannot be cited here. Any thesis section that wants to discuss commit history should be filled in from that external source directly by the team, not fabricated to match this analysis.

## Recommendation

If a development-history section is required by the university template, the team should either:
1. Point the thesis to the actual GitHub/GitLab repository (if one exists) and pull real commit statistics from there before writing that section, or
2. Reframe the section around the project-management evidence that *does* exist in this repo — e.g., the phased task breakdown implied by `README.md`'s "Giới hạn hiện tại" section, or a team-maintained plan/timeline document if one exists outside this snapshot — rather than a commit-log-based narrative.

This file exists specifically so that no other chapter or evidence file in this pack states or implies a fabricated commit history.
