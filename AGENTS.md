# Project Instructions

## Communication
- Reply to me in Hebrew. Write code, new comments, commit messages, and new docs in English.
- Existing Hebrew comments stay as they are; do not translate them. Only new or changed code gets English comments.
- Text that users see (the store UI, email templates, the FAQ) is product content and stays in Hebrew.
- Docs that already exist in Hebrew, such as `docs/a11y-audit.md`, stay in Hebrew.

## Security
- Never commit or expose secrets (tokens, API keys, passwords).
- Never read a real env file; read `.env.example` for the variable names.
- Never reference a server-side secret from code that runs on a client.

## Guardrails (Single Source of Truth)
- Guardrail logic lives in `.claude/hooks/` and is wired in `.claude/settings.json`; a hook script that is not listed there never runs.
- Do not duplicate permission or hook rules in other instruction files.
- If any instruction conflicts with the hooks, the hooks win.
- If a hook blocks an action, do not work around it with another tool. Stop and report what was blocked and why.
- A script that writes to a remote database or to cloud storage gets a pattern in `PROJECT_DENY_PATTERNS` in the same commit that adds it.

## Repository Layout
- `docs/` holds the existing project docs and `.doc/` holds the project definition, glossary, architecture notes and audit files; never create another documentation folder.
- `.claude/rules/` — always-on constraints, imported below. Short by design.
- `.claude/skills/` — procedural know-how, loaded on demand by task.
- `.claude/hooks/` — guardrail hook implementations, wired by `.claude/settings.json`.
- `.plan/` — `000-backlog.md` is the task queue; `NNN-YYYY-MM-DD-*.md` are the plans.
- `server/` — the Express API: routes, controllers, services, models, middleware, validators, config, and the database migrations.
- `client/` — the React storefront and admin (Create React App): code in `client/src/js/`, styles in `client/src/css/`. `client/build/` is the build output and is not committed.
- `scripts/` — the npm scripts: catalogue import, demo data, the product-photo pipeline, and the accessibility audit.
- `test/` — the server test suites (`unit-*`, `smoke-*`), run by `test/run-all.js`.
- `design-assets/` — category and hero images and the shooting-day lists; local backups are not committed.
- `photos/` — raw and processed product photos for the shooting-day pipeline; their contents are not committed.
- `uploads/`, `uploads-originals/` — images uploaded through the admin, as served and at full resolution; runtime content, not committed.
- Temporary files go to the agent's session scratchpad directory when it has one, never to `/tmp` and never into the repository.

## Rules — always in context
@.claude/rules/code-style.md
@.claude/rules/naming.md
@.claude/rules/git-workflow.md
@.claude/rules/ui-and-styling.md

## Skills — load when the task calls for it
| Skill | Use it when |
|---|---|
| [`error-handling`](.claude/skills/error-handling/SKILL.md) | Shaping an error response, status code, retry, or failure UX |
| [`refactoring`](.claude/skills/refactoring/SKILL.md) | Auditing existing code, or planning a structural change that must not alter behavior |
| [`understanding-code`](.claude/skills/understanding-code/SKILL.md) | Learning an existing codebase: the codebase map, feature walkthroughs, or understanding exercises |
| [`writing-plans`](.claude/skills/writing-plans/SKILL.md) | Creating, revising, or superseding a plan in `.plan/` |
| [`writing-tests`](.claude/skills/writing-tests/SKILL.md) | Adding or reviewing unit or integration tests |

## Product and Domain
- Product definition and acceptance criteria: `.doc/product-definition.md`.
- Architecture overview: `docs/ARCHITECTURE.md`; `.doc/architecture.md` adds configuration, limits, and test coverage, and links to it.
- Canonical domain terms: `.doc/glossary.md` — define a new shared term there before using it.
- Keep these docs, `README.md`, and `docs/ARCHITECTURE.md` updated when an API endpoint, an npm script, the database schema (a migration), an environment variable, a feature, or the layers and architecture decisions change, or when a test suite is added or removed.
