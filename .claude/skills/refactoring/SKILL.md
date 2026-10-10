---
name: refactoring
description: Audit existing code without changing it, or plan a structural change that must not alter behavior. Use when asked to audit existing code, review its structure, readability, or architecture, write a findings report, or plan a refactoring step. Covers the finding format, the severity scale, backlog items, and the four rules every change follows.
---

# Refactoring

Applies to auditing existing code and to every structural change that follows an audit.

## Audit (read-only)
- Read source files only. Never read dependency folders, build output, or env files.
- Change nothing. Run nothing: the only command is the test baseline, run once before the
  audit and recorded in `.doc/test-baseline.md`.
- Start from the codebase map (`.doc/codebase-map.md`) and the test baseline when they exist.
- Never assume the code is sloppy. Every finding needs evidence. Never invent findings to
  fill the report: zero findings is a valid result.

## Finding format
Write the findings to `.doc/code-audit.md`, numbered `F01`, `F02`, and so on, one block each:

```
### F01 — <short title>
- Evidence: `<path>:<line>`
- Severity: <high, medium, or low>
- Category: <structure, readability, or architecture>
- Suggested change: <what to change, in one or two sentences>
- Behavior: unchanged
- Pinned by tests: <yes (test file) or no>
```

- A fix that would change behavior is not a finding. List it under `## Behavior questions`
  for the owner instead.
- When there are no findings, write exactly `No findings were found.` on its own line.
- Never quote a secret value or a connection string; cite the line only.

## Severity
- **high**: it can cause wrong behavior, data loss, or a security problem, or it blocks any
  safe change.
- **medium**: a common change has to touch many places.
- **low**: naming, dead code, or readability.

## Backlog items
- Add one `- [ ] <title> | audit Fnn` item per finding to `.plan/000-backlog.md`.
- If any finding has `Pinned by tests: no`, the first item adds tests that pin the current
  behavior.

## Rules for every change
1. **Same technology.** Never replace, add, or remove a framework, language, database, or
   major library. The project keeps its stack. A change of technology is a separate
   decision for the owner, never part of a refactoring.
2. **Behavior must not change.** Before any structural change, tests that pin the current
   behavior must exist. If they are missing, adding them is the first step, on its own.
   If the project has no test tool, choosing one is a decision for the owner: ask before
   adding it.
3. **One small change per step.** Make exactly one single-purpose change per plan step,
   with check-first validation, and get the owner's approval before the next step starts.
4. **Propose and wait.** Propose each change and wait for the owner's approval. Never run
   a bulk refactor.

Improvements run inside the project, each as its own plan in `.plan/`, and never as part
of an audit.
