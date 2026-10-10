---
name: understanding-code
description: Explain an existing codebase without changing it. Use when the owner asks to explain this codebase, how a feature works, or for help learning the code, or when writing or refreshing the codebase map. Covers the codebase map, feature walkthroughs, project terms, and optional understanding exercises.
---

# Understanding Code

Applies to explaining existing code. Never change code, tests, or configuration while
explaining it.
Never read dependency folders, build output, or env files.

## Codebase map
- Write the map to `.doc/codebase-map.md` as plain Markdown. Start it with
  `Commit: <hash>`, the commit the map describes.
- Give its `## Architecture overview` these four subsections, in this order:
  - `### Folders`: the top-level folders and what each one holds.
  - `### Layers`: the layers of the code and what each layer calls.
  - `### Frontend to backend`: how the user interface reaches the server, and the entry
    points on each side.
  - `### Database`: where the code reads and writes stored data.
- If a subsection does not apply, say so in one line. Never invent content to fill it.
- Give every claim a `path:line`. Read the cited line before writing the claim.

## Feature walkthroughs
- Ask the owner to name or confirm the main features. Write one walkthrough per feature
  under `## Feature walkthroughs` in the map.
- Title each one `### Wnn — <feature>: from <trigger> until <result>`, for example
  "W01 — Place an order: from submitting the order form until the confirmation email is
  sent".
- Write each step as a numbered line that ends in `` `path:line` ``, in the real call order.
- Before writing a step, read the cited line and confirm that it shows that step.

## Project terms
- Propose terms for `.doc/glossary.md` in its format, `term — definition. Not synonym.`,
  each with the `path:line` where the code uses it.
- Write a term only after the owner confirms it. Keep the glossary the only list of terms;
  never start a second one.

## Understanding exercises
Exercises are optional. Offer them; the owner can decline them or stop at any time.

1. Pick one part: one walkthrough or one component.
2. State the goal first: what the owner will be able to explain after the exercise.
3. Explain the part, citing `path:line`.
4. Ask one question about it, for example "Which file handles this step?" or "What
   happens when this call fails?". Let the owner answer first, and wait.
5. Only then give feedback, citing `path:line`. Ask the next question, one at a time.

Never change code or tests during an exercise. The questions check understanding; they
are not a test and get no score.

The map is a learning aid. Refresh it when the code changes, and update its `Commit:`
line. It never replaces `.doc/architecture.md`. Propose a link to the map from there, and add
it only after the owner approves; during the setup's Phase B, never write that file.
