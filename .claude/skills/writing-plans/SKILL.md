---
name: writing-plans
description: Create, revise, or supersede an implementation plan in .plan/. Use whenever the user asks for a plan, an approach, or a design doc for a task, or when revising an existing plan after feedback. Defines the .plan/ lifecycle, the NNN-YYYY-MM-DD-topic.md filename, required metadata, and the nine required sections.
---

# Writing Plans

`.plan/` at the repository root is the source of truth for plans. `000-backlog.md`
is the task queue; every other `NNN-*.md` file is a plan.

## Before writing anything
1. Read the existing `.plan/*.md` — do this even when the request names no plan
   file. A new plan must build on decisions already made, not contradict them.
2. Read `.doc/product-definition.md` for acceptance criteria and scope.
3. If `.plan/` does not exist, create it.

## Filename
`NNN-YYYY-MM-DD-<topic>.md`, with a sequential numeric prefix — `001`, `002`, `003`.
Example: `.plan/003-2026-08-03-invoice-export.md`.

## Skeleton
Start every new plan from a copy of [PLAN-TEMPLATE.md](../../../.plan/PLAN-TEMPLATE.md).
It holds the metadata block and the nine section headings below.

## Required metadata
Near the top of every plan:

```
Status: draft | active | done | superseded
Owner:
Last updated: YYYY-MM-DD
```

New plans start as `Status: draft`. Only the human approval gate flips a plan to
`active`.

## Required sections
Every plan must contain all nine, in this order:

`Goal` · `Scope` · `Assumptions` · `Open Questions` · `Steps` · `Validation` ·
`Risks` · `Rollout Order` · `Rollback`

## Content rules
- Repository-relative paths only. Never machine-specific absolute paths. `docs/` holds the existing project docs and `.doc/` holds the project definition, glossary, architecture notes and audit files; never create another documentation folder.
- Respect the task's declared scope. Do not plan work outside it; if the task needs
  more, raise it as an Open Question.
- `Validation` is the checklist the finished work is verified against, so make each
  item provable by a test or a command.

## Check commands
- Mark every Validation command `owner-run` or `agent-run`.
- A command whose text names an env file is always `owner-run`: the secret-file hook
  matches env-file names anywhere in a command string, so the agent is blocked from
  running it.
- Write `owner-run` commands for Windows PowerShell 5.1, using only that shell's own commands.
  `agent-run` commands may use the agent's own shell tools.
- End-of-line anchors in checks against text files use `[[:space:]]*$`, not a bare `$`:
  with `core.autocrlf=true`, files are checked out with CRLF line endings, and a bare `$`
  misses those lines in some tools.
- Before writing new wording into a file, run the check regex that will inspect it
  against that wording, and confirm the result is the one the check expects. New wording
  can satisfy or break its own check by accident.

## Open Questions and approval
- Ask every plan question **inside the plan file**, not in the conversation.
- Make each question easy to answer, and include a recommended answer.
- Update the plan once answers arrive.
- Request approval before executing the plan.

## Superseding a plan
When a plan is replaced, set the old plan to `Status: superseded` and add a link
to the replacing plan.
