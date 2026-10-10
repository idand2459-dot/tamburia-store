# SETUP

## How to use this template
If an `## Adaptation log` section already exists at the end of this file, the adaptation was already done: do not repeat it, and tell the owner.

Choose the path first. A new, empty folder follows items 1–3 below and then Steps A–F. A folder that already has code follows "Path: existing project" near the end of this file instead.

1. Copy every file of this template into the new project's folder, except `.git` and the template's own plans: from `.plan/`, copy only `000-backlog.md` and `PLAN-TEMPLATE.md`.
2. Open Claude Code in that folder.
3. Say: "Read SETUP.md and follow it".

**Before you start** (Claude Code, new-project path only, before Step B; "Path: existing project" has its own): run `node --version`. If Node.js is missing, stop and tell the owner to install it before continuing: the guardrail hooks are Node scripts, and a hook that cannot start does not block anything. Then check git: if the folder is not a git repository, tell the owner to run `git init -b main` and wait; if it is one and its current branch is not `main`, tell the owner, because the git-workflow rule says `main`. Never run a git command that writes yourself.

Everything below is addressed to Claude Code. Follow the steps in order. Do not skip, merge, or reorder them.

## Template contents
| Path | What it is |
|---|---|
| `AGENTS.md` | The canonical instruction file. |
| `CLAUDE.md`, `.cursor/rules/index.mdc`, `.github/copilot-instructions.md` | Pointer files to `AGENTS.md`. They never change during the adaptation of a new project; in "Path: existing project", a project's own pointer file changes only through an approved merge (Phase A item 6). |
| `.claude/settings.json` | Permission deny list and hook wiring. |
| `.claude/hooks/block-unapproved-git.mjs`, `.claude/hooks/block-secret-file-access.mjs`, `.claude/hooks/block-destructive-bash.mjs` | Guardrail hooks. |
| `.claude/rules/code-style.md`, `.claude/rules/naming.md`, `.claude/rules/git-workflow.md`, `.claude/rules/ui-and-styling.md` | Always-on rules, imported by `AGENTS.md`. |
| `.claude/skills/error-handling/SKILL.md`, `.claude/skills/refactoring/SKILL.md`, `.claude/skills/understanding-code/SKILL.md`, `.claude/skills/writing-plans/SKILL.md`, `.claude/skills/writing-tests/SKILL.md` | Skills, loaded on demand. |
| `.doc/product-definition.md`, `.doc/architecture.md`, `.doc/glossary.md` | Documentation templates. |
| `.plan/000-backlog.md`, `.plan/PLAN-TEMPLATE.md` | Empty backlog and the plan skeleton. |
| `.gitignore` | Generic ignore rules; the stack-specific part is appended in Step D. |
| `SETUP.md` | This file. It stays in the project after adaptation. |

## Step A — Read everything first
1. Read every file listed in "Template contents" with the file-read tool, in full. Do not rely on the context that is loaded automatically: HTML comments, such as the PREFERENCE blocks and the template notes, may be stripped from it.
2. Change nothing in this step.
3. During the whole procedure, do not run any git command that writes (`git add`, `git commit`, `git merge`, `git push`, `git tag`, `git reset`, `git checkout -- …`). The only exception is the live hook test in Step E, and only with the owner's explicit permission. During setup even `git add` is left to the owner, on purpose, so that the owner can review what the adaptation changed before anything is staged; this is stricter than the git-workflow rule and does not replace it.
4. If a hook blocks any action, stop, report what was blocked and why, and wait. Never work around a hook with another tool.

## Step B — Interview the owner
Ask one question at a time. Wait for each answer before asking the next. Record every answer; Step F needs them.

1. What is the project, who is it for, and what problem does it solve for them?
2. What is the goal of version 1: what is in scope, what is deliberately out of scope, and which observable behaviors prove it is done?
3. What is the stack and runtime (languages, frameworks, package manager, external services)?
4. What is the folder layout: the top-level source directories, and is there a directory for generated artifacts?
5. Does the project have a UI? If yes: which toast library, icon library, styling engine, UI directory, global stylesheet, and where design tokens live.
6. Does the project expose an HTTP API? If yes: its development base URL and its main endpoints.
7. Which test runner is used, where do unit tests live, and what command runs them?
8. Preferences: which language should replies be in, and which language for code, comments, commit messages, and docs? Trailing semicolons: none, required, or decided by the formatter? Which shell do you run commands in (for example Windows PowerShell 5.1, bash, or zsh)? Ask its three parts one at a time.
9. Which destructive commands does this stack have that must be blocked (for example a database reset or a cloud resource delete)? Which env files exist, and in which directories?
10. Which changes should trigger an update of the `.doc/` files (for example a new command, a new endpoint, or a changed data shape)?
11. Does the project have a browser-driven end-to-end test suite? If yes: which tool, where do the tests live, and what command runs them?

## Step C — Never guess
- Do not edit any file before all of Step B is answered.
- If an answer is "I don't know yet", do not invent a value. Keep the placeholder, and add the question under a `## Open Questions` section at the end of `.doc/product-definition.md` (create the section if it does not exist).
- Infer nothing from the folder's current contents. An empty or unfamiliar folder is not evidence of a stack. (In "Path: existing project", Phase A item 5 replaces this bullet.)

## Step D — Adapt, in this order
Use the "Placeholder legend" below for every `{{…}}` marker, and the "Marker legend" for every PREFERENCE block.

1. **`AGENTS.md`.** Fill or delete each placeholder. Resolve the Communication PREFERENCE block. Delete the `{{GENERATED_ARTIFACTS_DIR}}` line if there is no such directory, and the `{{PROJECT_DIRECTORIES}}` line if there are no project directories yet; never leave either as a placeholder. Leave the SETUP pointer line (the line that starts "If this file still contains a placeholder") until Step F.
2. **Rules in `.claude/rules/`.**
   - `code-style.md`: resolve the semicolon PREFERENCE block from answer 8.
   - `naming.md` and `git-workflow.md`: no placeholders. Replace the example names only if they clash with the project's own domain.
   - `ui-and-styling.md`: fully rewritable. Rewrite every section from answer 5, or follow "Path: no UI" below.
3. **Skills in `.claude/skills/`.** Fill the placeholders. Never change a skill's front matter `name`. Follow "Path: no UI", "Path: no generated-artifacts directory", "Path: no HTTP API" and "Path: no end-to-end tests" below where they apply.
4. **`.claude/settings.json` and the hooks.**
   - `block-destructive-bash.mjs`: add one regular expression per destructive command from answer 9 to `PROJECT_DENY_PATTERNS`, then remove the `{{PROJECT_DESTRUCTIVE_PATTERNS}}` marker from the comment above it (keep the explanation). With no such commands, leave the array empty and remove the marker the same way. A pattern matches any shell command that contains its words, even a harmless one such as a search, so keep each pattern narrow and anchored to the command name. Add each pattern with the file-edit tool; afterwards print the line and confirm that every backslash is still a backslash followed by a letter, not a control character. Add one test row per pattern to the payload block, as Step E item 5 says.
   - `settings.json`: for each directory from answer 9 that has its own env file, add a `Read(./<directory>/.env)` entry to `permissions.deny`. Do not remove any existing entry. Every hook command keeps the `$CLAUDE_PROJECT_DIR` path.
5. **`.doc/` files.** Fill every section from the answers. Delete the "API Contract" section of `architecture.md` if answer 6 is no; if it is yes, delete only its "Delete this section if …" line. After a file is filled in, delete its first line, the "Template: fill in during adaptation" comment: that comment contains a literal curly-brace marker and would keep the unresolved-placeholder check true forever. In `glossary.md`, replace the two invoice examples with the project's own terms. Define only terms the owner gave; do not name fields or types the owner has not given, and record an open question instead.
6. **`.plan/000-backlog.md`.** Add the version 1 tasks from answer 2 under `Current queue:`, one item each, in priority order. Do not touch `.plan/PLAN-TEMPLATE.md`; it keeps `{{PLAN_TITLE}}` on purpose.
7. **`.gitignore`.** Append the stack-specific ignores (build output, dependency directories, caches) below the `{{STACK_SPECIFIC_IGNORES}}` heading, then replace that heading with `# Stack-specific`. Never remove the generic lines above it.
8. **The template's own plans.** A template plan is a `.plan/NNN-*.md` file whose first line starts with `# NNN — ai-dev-starter:`, for example `.plan/001-2026-10-09-starter-template.md`. If one exists in the project, delete it: the `writing-plans` skill reads every file in `.plan/` as project history. If the project had its own `.plan/` files before the template was copied, ask the owner before deleting anything there.

### Path: no UI
- Delete `.claude/rules/ui-and-styling.md`.
- Delete its import line `@.claude/rules/ui-and-styling.md` in `AGENTS.md`.
- Delete the "Frontend and UX" section of `.claude/skills/error-handling/SKILL.md`, which refers to the UI and styling rule.

### Path: no generated-artifacts directory
- Delete the `{{GENERATED_ARTIFACTS_DIR}}` line in `AGENTS.md`.
- Delete the matching bullet ("Generated artifacts belong in …") in `.claude/skills/writing-plans/SKILL.md`; keep the "Never create a `docs/` directory" rule by moving it into the bullet above or below.

### Path: no HTTP API
Apply this when answer 6 is no.
- In `.claude/skills/error-handling/SKILL.md`, delete the "API response shape" and "Status codes" sections, and in "Categories" and "Tests" remove only the wording that depends on them.
- In `.claude/skills/writing-tests/SKILL.md`, under "Must be covered", delete the bullets that do not apply to the project (API request validation and error responses; auth boundary enforcement; persistence-critical paths), and keep the others.
- In `AGENTS.md`, delete the Security bullet about server-side secrets in code that runs on a client, when the project has neither a UI nor an HTTP API.

### Path: no end-to-end tests
Apply this when answer 11 is no.
- In `.claude/skills/writing-tests/SKILL.md`, delete the "End-to-end tests" section and the "End-to-end" row of the suite table, and change "Applies to unit and integration tests, and to end-to-end tests when the project has them." to "Applies to unit and integration tests."
- If an instruction file that existed before the template was copied names an end-to-end tool or suite, propose deleting those lines to the owner and wait.

## Step E — Verify
1. **Unresolved placeholders.** Run:
   `git grep --no-index -n -E '\{\{[A-Z][A-Z0-9_]*\}\}' -- . ':!.git/' ':!.plan/' ':!SETUP.md'`
   Every line it prints must be a placeholder you kept on purpose, because Step B or Step C left it unknown. The `AGENTS.md` directory lines may never be kept. `SETUP.md` is excluded because its legend lists the names on purpose; `.plan/` is excluded because `PLAN-TEMPLATE.md` keeps `{{PLAN_TITLE}}`.
2. **PREFERENCE blocks.** In every file, the number of `<!-- PREFERENCE` markers equals the number of `<!-- END PREFERENCE -->` markers.
3. **Imports resolve.** Every `@.claude/rules/*.md` line in `AGENTS.md` names a file that exists, and `CLAUDE.md` still contains exactly one `@AGENTS.md` line.
4. **Hooks start.** For each of the three hooks, run `node --check .claude/hooks/<name>.mjs` (must pass), and pipe an empty payload `{}` into it (must exit `0`).
5. **Hook payload tests: the owner runs these.** The live hooks block several of these commands on purpose (they contain env-file names, `rm -rf`, or chained git commits), so do not run them yourself and do not wrap them in a script to get past the hooks. Show the owner this block and ask them to run it in their own PowerShell terminal at the project root, then report the result:

   ```powershell
   [Console]::InputEncoding = [System.Text.UTF8Encoding]::new($false)
   $tests = @(
     @('block-unapproved-git',       '{"tool_name":"Bash","tool_input":{"command":"git commit -m x"}}', 2),
     @('block-unapproved-git',       '{"tool_name":"Bash","tool_input":{"command":"git status --short"}}', 0),
     @('block-unapproved-git',       '{"tool_name":"Bash","tool_input":{"command":"git add . && git commit -m x"}}', 2),
     @('block-unapproved-git',       '{"tool_name":"Bash","tool_input":{"command":"git -C . push"}}', 2),
     @('block-secret-file-access',   '{"tool_name":"Read","tool_input":{"file_path":"./.env"}}', 2),
     @('block-secret-file-access',   '{"tool_name":"Bash","tool_input":{"command":"cat .env"}}', 2),
     @('block-secret-file-access',   '{"tool_name":"Read","tool_input":{"file_path":"./.env.example"}}', 0),
     @('block-secret-file-access',   '{"tool_name":"Bash","tool_input":{"command":"node -p process.env.HOME"}}', 0),
     @('block-destructive-bash',     '{"tool_name":"Bash","tool_input":{"command":"rm -rf ./x"}}', 2),
     @('block-destructive-bash',     '{"tool_name":"Bash","tool_input":{"command":"git push --force"}}', 2),
     @('block-destructive-bash',     '{"tool_name":"Bash","tool_input":{"command":"DELETE FROM users"}}', 2),
     @('block-destructive-bash',     '{"tool_name":"Bash","tool_input":{"command":"npm test"}}', 0)
   )
   foreach ($t in $tests) {
     $t[1] | node ".claude/hooks/$($t[0]).mjs"
     $result = if ($LASTEXITCODE -eq $t[2]) { 'PASS' } else { 'FAIL' }
     '{0}  {1}  expected={2} got={3}  {4}' -f $result, $t[0], $t[2], $LASTEXITCODE, $t[1]
   }
   ```

   The first line matters on Windows PowerShell 5.1: without it a byte-order mark breaks `JSON.parse` in the hooks, they exit `0` for everything, and every blocking test fails. Every line must print `PASS`. Add one line per pattern added to `PROJECT_DENY_PATTERNS`, expecting `2`.
6. **Live hook test.** Ask the owner for permission to attempt `git commit -m "hook test"` once through the shell tool, with nothing staged, so that a broken hook still cannot create a commit. Only with that permission, attempt it. Expected: blocked by the guardrail hook. If the folder is not a git repository yet, skip this and say so.
7. **Report.** Give the owner a summary of every file changed, deleted, or kept unchanged, and every placeholder kept on purpose.

## Step F — Record the outcome
1. Delete the SETUP pointer line in `AGENTS.md` (the line that starts "If this file still contains a placeholder").
2. Append an `## Adaptation log` section at the end of this file. Record names only, never the values of any secret, token, key, or password, and never the contents of an env file. Write the log with the file-edit tool, never through a shell command, because the destructive-command hook matches its patterns anywhere in a command string, even in text that is only written to a file. The log contains:
   - `Adapted on YYYY-MM-DD.`
   - The answers from Step B, one line each.
   - Filled: each placeholder and its value.
   - Deleted: each file, section, line, and PREFERENCE block removed, and why, including every template plan deleted in Step D item 8.
   - Kept: each placeholder kept on purpose, and the open question that explains it.
   - That the `AGENTS.md` SETUP pointer line was removed.
3. Do not delete this file. It is the record of how the project's instructions were derived.

## Path: existing project
Follow this path instead of Steps A–F when the folder already has code. It adapts the template to the project, never the project to the template. Never change the project's technologies: never install, remove, upgrade, or replace a dependency, framework, language, database, or tool. Never overwrite, rename, move, or delete an existing project file without asking the owner first and getting approval for that file. The owner starts this path by saying: "Read `.ai-dev-starter/SETUP.md` and follow the existing-project path".

### Phase A — Adapt the environment
1. **Before you start.** Run `node --version`; if Node.js is missing, stop, as "Before you start" says. The folder must be a git repository; if it is not, stop and tell the owner. Run `git status --short`: it must print nothing. If it prints anything, stop and ask the owner to commit or stash the changes. Then ask the owner to create the branch `chore/ai-setup` (`git switch -c chore/ai-setup`) and wait. Never run a git command that writes yourself; Step A items 3 and 4 apply to this whole path.
2. **Stage.** The owner copies the template into `.ai-dev-starter/` at the project root, except `.git` and the template's own plans: from `.plan/`, only `000-backlog.md` and `PLAN-TEMPLATE.md`. In this path, read every template file from `.ai-dev-starter/<path>`, and write every adapted file to `<path>` at the project root. Never stage or commit `.ai-dev-starter/`.
3. **Guardrails first.** Read every staged template file in full, as Step A item 1 says, and the project's `.claude/` folder if it exists. Then propose the three hooks and the merged `.claude/settings.json`: append the template's hook entries and `permissions.deny` entries, and keep every existing entry, hook, and matcher; never reorder or remove anything. A project hook with the same file name as a template hook is a conflict (item 6). Wait for approval, write, and ask the owner to reload hooks (`/hooks` or a restart). Then run Step E items 4–6. Read nothing else in the project until the hooks are live.
4. **Inventory, read-only.** Read and record each fact with its evidence as `path:line`:
   - the stack: the package manifests at the root and in subfolders, the lockfile and so the package manager, and each package script's name and command;
   - the test setup: runner config, test folders, test scripts, and any config or dependency of a browser-driven suite;
   - the top-level folder layout;
   - `README.md`, `AGENTS.md`, `CLAUDE.md`, `.cursor/`, `.github/copilot-instructions.md`, the `.claude/` contents (settings, hooks, rules, skills, agents, commands), `.gitignore`, any `docs/`, `.doc/`, or `.plan/` folder, and `SETUP.md`;
   - the git state: the current branch, the other branch names, and the remote names.

   Never read an env file; read `.env.example` for variable names. Report `.claude/settings.local.json` as present or absent, and never edit it. Skip dependency folders and build output.
5. **Confirm, then ask.** In this path, this rule replaces Step C's last bullet: a fact counts only with file evidence, and the owner confirms every fact. Show the owner the inventory as a table (fact, evidence) and ask, as one question, whether it is correct. Then ask, one at a time, only the Step B questions that the evidence does not answer. Always ask questions 1, 2, 8, and 10. Always confirm question 9 (destructive commands), even when the scripts suggest an answer. Edit nothing before every answer is in.
6. **Adapt, under the conflict rules.** Apply Step D in its order, with these rules for what already exists:

   | Already in the project | What to do |
   |---|---|
   | Nothing at that path | Create the file from the template, and report it as new. |
   | `AGENTS.md` | Never replace it. Propose a merge that keeps every existing rule and adds the missing template sections. For each contradiction, show both texts and ask which one wins. Write only after approval. |
   | `CLAUDE.md`, `.cursor/rules/*`, `.github/copilot-instructions.md` with their own content | Propose moving the rule content into `AGENTS.md` and reducing the file to the template pointer. If the owner declines, propose only adding the `@AGENTS.md` import to `CLAUDE.md`. Wait. |
   | `.claude/settings.json` | Already merged in item 3. |
   | `.claude/settings.local.json` | Never edit it. Report it, because its hooks and permissions add to the shared ones. |
   | Own hooks, rules, skills, agents, or commands under `.claude/` | Keep them all. A template file with the same name is a conflict: show both and ask. A template rule that contradicts an existing one is a conflict too. |
   | `.gitignore` | Append only the template lines that are missing, under a heading. Never reorder or remove a line. |
   | `docs/` or another documentation folder | Never move or rename it. Ask whether to create `.doc/` or to point the `AGENTS.md` "Product and Domain" section at the existing files. |
   | `.plan/` | Keep it. Add `000-backlog.md` and `PLAN-TEMPLATE.md` only if they are missing. New plans continue the existing numbering. |
   | `SETUP.md` | A conflict: ask which name the template's `SETUP.md` gets. |
   | `README.md`, application code, package manifests, lockfiles, configs | Never change them. |

   For every file: never overwrite, rename, move, or delete an existing project file without the owner's explicit approval for that file. For each conflict, show the existing text, the template text, and a proposed merge, then wait. Never install, remove, or upgrade a dependency, and never add a tool. If the template expects something the project lacks (for example a unit test runner), record an open question instead (Step C).
7. **Verify.** Run Step E, with `':!.ai-dev-starter/'` added to the item 1 command. Then run `git status --short`: every path it prints must lie in `AGENTS.md`, `CLAUDE.md`, `SETUP.md`, `.gitignore`, `.claude/`, `.doc/`, `.plan/`, `.cursor/rules/`, `.github/copilot-instructions.md`, or `.ai-dev-starter/`, and every pre-existing file that changed must have an approved merge. Any other path is a defect: report it to the owner and stop.
8. **Record.** Follow Step F in the project-root `SETUP.md` (or the name the owner chose in item 6), and add these log lines: `Path: existing project`; `Merged with owner approval:` each file and what changed; `Declined:` each proposal the owner declined. Phase B adds its own `Phase B:` line. Then ask the owner to delete `.ai-dev-starter/`; never delete it yourself.

### Phase B — Code audit, read-only
Start Phase B only after Phase A is recorded. Never change application code, tests, manifests, lockfiles, or configs in this phase. Write only these files: `.doc/test-baseline.md`, `.doc/codebase-map.md`, `.doc/glossary.md` (add confirmed terms only; never change or remove an existing line), `.doc/code-audit.md`, `.plan/000-backlog.md` (add items only; never change or remove an existing line), and the `## Adaptation log` of the project-root `SETUP.md`, or the name the owner chose in Phase A item 6 (add `Phase B:` lines only). Never run any command except the test command in item 2, and these two read-only git commands: `git rev-parse HEAD` and `git status --short`. The owner can answer "no" to every question below: log each "no" as a line that starts with `Phase B:`, and never log a decision before the owner makes it. If the owner chose in Phase A item 6 not to create `.doc/`, ask once which folder takes these `.doc/` files, and use it in their place.

1. **Consent.** Ask: "May I run the existing tests once, write a codebase map, and then write a findings report and backlog items? I will change no code." On no, log `Phase B: declined` and stop. On yes, log `Phase B: consented`.
2. **Test baseline.** Propose the project's own test command from the Phase A inventory, then ask: "Does this command touch only test or local data, and no production or shared database?" On yes, run it once. If it needs a database or server that has to be started first, ask the owner to start it; never start one yourself. If the test command needs dependencies that are not installed, ask the owner to install them in their own shell and wait; never install them yourself. On no, log `Phase B: test command not confirmed as safe`, and ask whether the owner wants to run it in their own shell and paste the summary. If the owner declines that too, log `Phase B: test baseline not run`, and skip item 5. Record a result in `.doc/test-baseline.md` with the lines `- Date:`, `- Commit:`, `- Command:`, `- Exit code:`, and `- Result: N passed, N failed, N skipped`, followed by the name of every failing test. Record a failing baseline as it is; never change a test or code to make it pass. Report to the owner every file the run created that git does not ignore; never delete it. Take the `- Commit:` hash, and later the map's `Commit:` hash, from `git rev-parse HEAD`; find the created files by comparing `git status --short` before and after the run.
3. **Codebase map.** Follow `.claude/skills/understanding-code/SKILL.md` for the codebase map, the feature walkthroughs, and the project terms. Ask the owner to name or confirm the main features, and to confirm each proposed term; log each declined term as `Phase B: term declined: <term>`.
4. **Understanding exercises.** Ask: "Do you want understanding exercises now?" On no, log `Phase B: exercises declined`. On yes, follow the exercises section of the same skill, and continue with item 5 only when the owner says so.
5. **Audit.** Skip this item when the test baseline was not run. Otherwise follow `.claude/skills/refactoring/SKILL.md` for the audit, the finding format, the severity scale, and the backlog items: write `.doc/code-audit.md`, and add the backlog items to `.plan/000-backlog.md`.
6. **Report.** Show the owner the baseline counts, the walkthrough list, and the finding count per severity (or that the audit was skipped), and stop.

Improvements are not part of this setup. Each one runs later, as its own plan in this project, under the `refactoring` skill's `## Rules for every change`.

## Optional modules
A module is an optional rule or skill that the template carries without any change to this file. Add a module only after a real failure or a real use shows the need. A module never changes the project's technologies and never overwrites an existing file without asking the owner.

A module is exactly one file: a rule `.claude/rules/<name>.md` or a skill `.claude/skills/<name>/SKILL.md`. Right after its title (for a skill, after the front matter), it carries this header:

```
<!-- MODULE
question: <one yes/no interview question that decides whether to enable it>
check: <one agent-run command that proves it was installed correctly>
use-when: <the AGENTS.md Skills-table text; skills only>
END MODULE -->
```

- **Slots.** Fill the header with `<angle>` slots only, never a `{{…}}` marker. The `check` command never names an env file.
- **Discovery.** `grep -rlE '^<!-- MODULE[[:space:]]*$' .claude/rules .claude/skills` lists every module; in the existing-project path, run it inside `.ai-dev-starter/`. After Step B question 11, ask each module's `question`, one at a time, in both paths. The owner's yes is the approval; never apply a module without it.
- **Install.** On yes: keep the file (in the existing-project path, copy it into the project under the Phase A conflict rules), add its import line under "Rules — always in context" in `AGENTS.md` for a rule, or its Skills-table row from `use-when` for a skill, and run its `check` in Step E. On no: delete the file (for a skill, its folder); in the existing-project path, leave it out. Step F logs each module as enabled or removed.
- **Capacity.** Adding a module to the template means adding one file; it never edits this file or any other template file. Installing it in a project still adds its import line or Skills-table row there (Install). The format holds, for example, a parallel-agent orchestration skill, an architecture-layering (MVC) rule, or a retrieval (RAG) skill. A module that needs more than one file is outside this format and needs its own plan.

## Provenance
Distilled from a finished project at commit `9711a9c`; synced manually and one way, from that project into this template, which is now the source of truth.

## Marker legend
- `{{UPPER_SNAKE}}`: a value that must be filled in. The "Placeholder legend" below says what to do with each one.
- `<!-- PREFERENCE: … -->` opens a personal default, and `<!-- END PREFERENCE -->` closes it. If the owner keeps the preference, delete only the two marker lines and keep the content (edited to the owner's answer). If the owner does not want it, delete the whole block, both markers included.

## Placeholder legend
"Same value in both" means: fill every file the name appears in with the identical value.

| Placeholder | Appears in | Fill with | If the project has nothing for it |
|---|---|---|---|
| `{{ACCEPTANCE_CRITERION}}` | `.doc/product-definition.md` | One observable behavior per `AC01`, `AC02`, … line, with the test or command that proves it. | Keep, and record an open question (Step C). |
| `{{API_BASE_URL}}` | `.doc/architecture.md` | The development base URL. | Delete the whole "API Contract" section. |
| `{{API_ENDPOINTS}}` | `.doc/architecture.md` | One `###` subsection per endpoint. | Delete the whole "API Contract" section. |
| `{{COMPONENT_PATH}}` | `.doc/architecture.md` | The path of a file or module, one table row each. | Keep until code exists; record it as kept. |
| `{{COMPONENT_RESPONSIBILITY}}` | `.doc/architecture.md` | What that file or module owns. | Keep until code exists; record it as kept. |
| `{{CONFIGURATION}}` | `.doc/architecture.md` | Every setting read, its default, and whether it is secret. | Write "No configuration." |
| `{{CORE_TERMS}}` | `.doc/glossary.md` | The project's domain terms, replacing the two examples. | Keep, and record an open question (Step C). |
| `{{DATA_FLOW}}` | `.doc/architecture.md` | One numbered list per main flow. | Keep until the design exists; record it as kept. |
| `{{DESIGN_TOKENS_LOCATION}}` | `.claude/rules/ui-and-styling.md` | The file where design tokens are declared. | Delete the "Design tokens" section; with no UI, follow "Path: no UI". |
| `{{DOC_UPDATE_TRIGGERS}}` | `AGENTS.md` | The changes from answer 10. | Delete that line. |
| `{{E2E_TEST_COMMAND}}` | `.claude/skills/writing-tests/SKILL.md` | The command that runs the end-to-end tests, from answer 11. | Follow "Path: no end-to-end tests". |
| `{{E2E_TEST_DIR}}` | `.claude/skills/writing-tests/SKILL.md` | The end-to-end test directory, from answer 11. | Follow "Path: no end-to-end tests". |
| `{{E2E_TOOL}}` | `.claude/skills/writing-tests/SKILL.md` | The tool that runs the end-to-end tests, from answer 11. | Follow "Path: no end-to-end tests". |
| `{{EXTERNAL_DEPENDENCIES}}` | `.doc/architecture.md` | Each external service or tool called at runtime. | Write "None." |
| `{{FAILURE_HANDLING}}` | `.doc/architecture.md` | Which errors are retried and which are not. | Keep until the design exists; record it as kept. |
| `{{GENERATED_ARTIFACTS_DIR}}` | `AGENTS.md`, `.claude/skills/writing-plans/SKILL.md` | The generated-artifacts directory. Same value in both. | Follow "Path: no generated-artifacts directory". |
| `{{GLOBAL_STYLESHEET}}` | `.claude/rules/ui-and-styling.md` | The single global stylesheet. | Delete that line; with no UI, follow "Path: no UI". |
| `{{ICON_LIBRARY}}` | `.claude/rules/ui-and-styling.md` | The icon library. | Delete that line; with no UI, follow "Path: no UI". |
| `{{IN_SCOPE_ITEM}}` | `.doc/product-definition.md` | One bullet per version 1 capability. | Keep, and record an open question (Step C). |
| `{{KNOWN_LIMITATIONS}}` | `.doc/architecture.md` | Known limitations. | Write "None known." |
| `{{LIMITS}}` | `.doc/architecture.md` | Size, count, and time limits enforced. | Write "None." |
| `{{LOGGING}}` | `.doc/architecture.md` | Log format, destination, contents, and what is never logged. | Keep until the design exists; record it as kept. |
| `{{OUT_OF_SCOPE_ITEM}}` | `.doc/product-definition.md` | One bullet per deferred item, with the reason. | Write "Nothing deferred yet." |
| `{{OWNER_SHELL}}` | `.claude/skills/writing-plans/SKILL.md` | The shell the owner runs commands in, from answer 8 (for example Windows PowerShell 5.1). | Keep, and record an open question (Step C). |
| `{{PRIMARY_USERS}}` | `.doc/product-definition.md` | The primary users. | Keep, and record an open question (Step C). |
| `{{PROBLEM_STATEMENT}}` | `.doc/product-definition.md` | The problem users have without the project. | Keep, and record an open question (Step C). |
| `{{PRODUCT_PURPOSE}}` | `.doc/product-definition.md` | One sentence: what the project is and who it is for. | Keep, and record an open question (Step C). |
| `{{PRODUCT_VISION}}` | `.doc/product-definition.md` | One sentence: what success looks like. | Keep, and record an open question (Step C). |
| `{{PROJECT_DESTRUCTIVE_PATTERNS}}` | `.claude/hooks/block-destructive-bash.mjs` | One regular expression per destructive command, in `PROJECT_DENY_PATTERNS`; then remove the marker from the comment. | Leave the array empty and remove the marker from the comment. |
| `{{PROJECT_DIRECTORIES}}` | `AGENTS.md` | One line per top-level source directory. | Delete the line; never keep it as a placeholder. |
| `{{SECONDARY_USERS}}` | `.doc/product-definition.md` | The secondary users. | Write "None in v1." |
| `{{STACK_SPECIFIC_IGNORES}}` | `.gitignore` | Stack-specific ignores appended below the heading; the heading becomes `# Stack-specific`. | Delete the heading line. |
| `{{STYLING_ENGINE}}` | `.claude/rules/ui-and-styling.md` | The styling engine. | Delete that line; with no UI, follow "Path: no UI". |
| `{{SYSTEM_OVERVIEW}}` | `.doc/architecture.md` | Entry points or processes, what each does, and where state lives. | Keep until the design exists; record it as kept. |
| `{{TEST_COVERAGE_MAP}}` | `.doc/architecture.md` | Which test proves each acceptance criterion. | Keep until tests exist; record it as kept. |
| `{{TOAST_LIBRARY}}` | `.claude/rules/ui-and-styling.md`, `.claude/skills/error-handling/SKILL.md` | The toast library. Same value in both. | Delete the line in both files; with no UI, follow "Path: no UI". |
| `{{UI_DIRECTORY}}` | `.claude/rules/ui-and-styling.md` | The directory that holds the UI code. | Delete that line; with no UI, follow "Path: no UI". |
| `{{UNIT_TEST_COMMAND}}` | `.claude/skills/writing-tests/SKILL.md`, `.doc/architecture.md` | The command that runs the unit tests. Same value in both. | Keep, and record an open question (Step C). |
| `{{UNIT_TEST_DIR}}` | `.claude/skills/writing-tests/SKILL.md`, `.doc/architecture.md` | The unit test directory. Same value in both. | Keep, and record an open question (Step C). |
| `{{VALUE_POINT}}` | `.doc/product-definition.md` | One bullet per benefit. | Keep, and record an open question (Step C). |

`{{PLAN_TITLE}}` in `.plan/PLAN-TEMPLATE.md` is not part of the adaptation: never fill it in the template itself, only in each copy made for a new plan.

## Adaptation log

Adapted on 2026-10-10.

Path: existing project. Branch `chore/ai-setup`; the template was staged in `.ai-dev-starter/`.

### Answers
1. Project: the online store of Technic Tambur, the owner's father's hardware shop. A public storefront (browse by category, cart, self pickup or delivery, order, confirmation email) and an admin side (products, orders, reviews). Goal: a complete, realistic store. Not launched; runs locally only.
2. Version 1: the store as it exists in the code today, finished and checked, not extended. In scope: S1–S18, per README.md, not yet verified against the code. Out of scope: hosting, a real domain, real customers, real payments (the code has none, `client/src/js/features/home/FAQ.js:23`). Done (AC01): locally, a customer completes an order with delivery, it appears in the admin side, and the confirmation email is written to the log with `MAIL_ENABLED=false`. Everything else: not decided yet.
3. Stack (from the inventory, confirmed): Node.js ≥ 18, Express 5, PostgreSQL via `pg` without an ORM, React 19 on Create React App, react-router 7, `ws`, Multer, sharp, Nodemailer; npm with two packages (root and `client/`).
4. Layout (confirmed): `server/`, `client/`, `scripts/`, `test/`, `docs/`, `design-assets/`, `photos/`, `uploads/`, `uploads-originals/`. No single generated-artifacts directory.
5. UI (confirmed): plain CSS in ITCSS partials under `client/src/css/` (`CONVENTIONS.md` is the rulebook), `app.css` imports only, tokens in `client/src/css/base/_variables.css`, icons from `lucide-react`, no toast library.
6. HTTP API (confirmed): yes, under `http://localhost:3000/api`; endpoints in the API table of README.md.
7. Tests (confirmed): server suites in `test/`, `npm test` (real local database); client Jest tests next to the code, `npm run test:client`.
8. Preferences: replies in Hebrew; code, new comments, commit messages and new docs in English; existing Hebrew comments and docs stay; user-facing text stays in Hebrew. Semicolons: always, as the existing code does; no formatter. Shell: Windows PowerShell 5.1 on Windows 11.
9. Destructive commands to block: `seed:demo`, `seed:demo:clear`, `products:import`, `products:import-new` and `products:hide-unphotographed` and `images:products` with `--apply` or `--revert`, `dropdb`, `git clean` (any), recursive deletes in PowerShell and cmd, `TRUNCATE`. Not blocked, by decision: `npm test`, `npm start`, `npm run migrate`, `taskkill`. Env files: `.env` at the root and `client/.env.development` (tracked; the owner confirmed it holds no secret).
10. Doc-update triggers: an API endpoint, an npm script, the database schema (a migration), an environment variable, a feature, the layers and architecture decisions, or a test suite added or removed.
11. End-to-end suite: none. `npm run a11y` is a separate accessibility gate.
Modules: the template carries none.

### Filled
- `AGENTS.md`: Communication (answer 8); `{{PROJECT_DIRECTORIES}}` → one line each for `server/`, `client/`, `scripts/`, `test/`, `design-assets/`, `photos/`, `uploads/` and `uploads-originals/`; `{{DOC_UPDATE_TRIGGERS}}` → answer 10, with `README.md` and `docs/ARCHITECTURE.md` added to the docs kept updated; the `.doc/` line → "`docs/` holds the existing project docs and `.doc/` holds the project definition, glossary, architecture notes and audit files; never create another documentation folder."; the cloud-script rule added under Guardrails.
- `.claude/rules/code-style.md`: semicolons always.
- `.claude/rules/ui-and-styling.md`: rewritten for the project (C5); `{{TOAST_LIBRARY}}` → none, `{{ICON_LIBRARY}}` → `lucide-react`, `{{UI_DIRECTORY}}` → `client/src/`, `{{STYLING_ENGINE}}` → plain CSS in ITCSS partials, `{{GLOBAL_STYLESHEET}}` → `client/src/css/app.css` (imports only), `{{DESIGN_TOKENS_LOCATION}}` → `client/src/css/base/_variables.css`.
- `.claude/skills/writing-plans/SKILL.md`: `{{OWNER_SHELL}}` → Windows PowerShell 5.1.
- `.claude/skills/writing-tests/SKILL.md`: `{{UNIT_TEST_DIR}}` / `{{UNIT_TEST_COMMAND}}` → `test/` with `npm test`, and `client/src/js/**/*.test.js` with `npm run test:client`; a row for the accessibility gate.
- `.claude/hooks/block-destructive-bash.mjs`: `{{PROJECT_DESTRUCTIVE_PATTERNS}}` → D1–D11 in `PROJECT_DENY_PATTERNS`.
- `.doc/product-definition.md`: `{{PRODUCT_PURPOSE}}`, `{{PRODUCT_VISION}}`, `{{PROBLEM_STATEMENT}}`, `{{IN_SCOPE_ITEM}}` → S1–S18, `{{OUT_OF_SCOPE_ITEM}}`, `{{PRIMARY_USERS}}` → the shop's customers, `{{SECONDARY_USERS}}` → the shop owner, `{{ACCEPTANCE_CRITERION}}` → AC01.
- `.doc/architecture.md`: `{{SYSTEM_OVERVIEW}}`, `{{COMPONENT_PATH}}` / `{{COMPONENT_RESPONSIBILITY}}`, `{{DATA_FLOW}}` (a link to `docs/ARCHITECTURE.md`), `{{CONFIGURATION}}` (setting names from `server/config/env.js`), `{{UNIT_TEST_DIR}}` / `{{UNIT_TEST_COMMAND}}`, `{{TEST_COVERAGE_MAP}}` (AC01 has no test yet), `{{EXTERNAL_DEPENDENCIES}}`, `{{LOGGING}}`, `{{FAILURE_HANDLING}}`, `{{LIMITS}}`, `{{KNOWN_LIMITATIONS}}`, `{{API_BASE_URL}}` → `http://localhost:3000/api`, `{{API_ENDPOINTS}}` → a link to the README API table.
- `.plan/000-backlog.md`: four items (test counts, `errorHandler.js:62`, static inline styles, a separate test database).
- `.gitignore`: `{{STACK_SPECIFIC_IGNORES}}` → nothing to add (the project's own lines already cover it), so no heading was added.

### Deleted
- The PREFERENCE blocks in `AGENTS.md` and `code-style.md` (both replaced with the owner's answers).
- `AGENTS.md`: the `{{GENERATED_ARTIFACTS_DIR}}` line (no single directory, C7), and "Never create a `docs/` directory" (replaced, C1).
- `writing-plans/SKILL.md`: the generated-artifacts bullet; its documentation rule moved into the bullet above it.
- `writing-tests/SKILL.md`: the "End-to-end tests" section and the end-to-end row (Path: no end-to-end tests).
- `error-handling/SKILL.md`: the `code` / `requestId` response shape, the `403`, `422` and `502` rows, the `requestId` and structured-log lines, and the toast line (C4).
- `naming.md`, `error-handling/SKILL.md`, `.doc/glossary.md`: the invoice examples.
- `.doc/product-definition.md`, `.doc/architecture.md`: the "Template: fill in during adaptation" first line.
- Template plans: none existed in `.plan/`.

### Kept
- `{{VALUE_POINT}}` in `.doc/product-definition.md`: the value proposition is not given yet (Open Questions).
- `{{CORE_TERMS}}` in `.doc/glossary.md`, and its first template line: terms are proposed and confirmed in Phase B (Open Questions).
- `{{PLAN_TITLE}}` in `.plan/PLAN-TEMPLATE.md`, on purpose.

The `AGENTS.md` SETUP pointer line was removed.

### Merged with owner approval
- `.gitignore` (C2): appended `!.claude/` and `.claude/settings.local.json` (`.claude/` was ignored at line 14), and the template's env lines with `!client/.env.development`; no line removed or moved.
- `.claude/settings.json`: new, from the template; then added `Read(./client/.env.development)`, `Read(~/AppData/Roaming/GitHub CLI/hosts.yml)`, and `"matcher": "PowerShell"` entries for the git and destructive-command hooks.
- `naming.md` (C3): rewritten to the existing conventions: plural API paths, PascalCase components, camelCase hooks, services and utils, snake_case database columns returned as is.
- `error-handling/SKILL.md` (C4): the shape `{ error: "<message>", details? }` through `AppError` and `errorHandler.js`; status codes found in the code; the stack-trace exception at `errorHandler.js:62` sent to the backlog.
- `ui-and-styling.md` (C5): `CONVENTIONS.md` is the CSS rulebook; inline `style` only for runtime values.
- `git-workflow.md` (C6): `type(scope): summary` commits; merges through a GitHub pull request (30 lines).
- `.doc/` (C1): created next to `docs/`; nothing in `docs/` was moved or renamed; `.doc/architecture.md` links to `docs/ARCHITECTURE.md`.
- New, from the template: `AGENTS.md`, `CLAUDE.md`, `.cursor/rules/index.mdc`, `.github/copilot-instructions.md`, the five skills, `.plan/000-backlog.md`, `.plan/PLAN-TEMPLATE.md`, `SETUP.md`.
- `.claude/settings.local.json`: present, never edited (allow entries only).

### Declined
- C1 option 2 (point `AGENTS.md` at `docs/` without a `.doc/`).
- Question 11 option 2 (`npm run a11y` as the end-to-end suite).
- T8 as a doc-update trigger (the glossary rule already covers new terms).
- Blocking `npm test`, `npm start`, `npm run migrate`, and `taskkill`.
- Extending the secret-file hook to `hosts.yml` and `gh auth token` (only the `Read` rule was added).

### Open questions
- Everything else about version 1 is not decided yet.
- The value proposition.
- README may be outdated; verify S1–S18 against the code in Phase B and list any feature that is missing or extra.
- AC01 has no automated test.
- No script writes to a remote database or to cloud storage today; when one is added, it gets a deny pattern in the same commit.
- Project terms for the glossary.
- Dependency timeouts and retries, and what is never logged: not checked yet.

### Guardrail findings
- PowerShell matcher gap: the template wires the git and destructive-command hooks with `"matcher": "Bash"` only, so a command sent through the agent's PowerShell tool was not checked. Fixed by adding `"matcher": "PowerShell"` entries; a live `git commit` through PowerShell was then blocked.
- False positive 1: a read-only `grep` whose search text contained `DROP DATABASE` was blocked by the destructive-command hook, which matches anywhere in a command. Resolved by searching without that text.
- False positive 2: a read-only `grep` of `server/config/env.js` was blocked by the secret-file hook, because the regex `process\.env\.` put a backslash before `.env`, and the hook treats a backslash as a path separator. No env file was read. Resolved with a fixed-text search (`grep -F "process.env"`).
- Not blocked by design: an unanchored SQL rule (`TRUNCATE`, like `DROP` and `DELETE`) also blocks a search for the word.

### Verification (Step E)
- Item 1: only the kept placeholders remain. Item 2: no PREFERENCE markers remain. Item 3: all four imports resolve; `CLAUDE.md` has one `@AGENTS.md`.
- Item 4: all three hooks pass `node --check` and exit `0` on `{}`.
- Item 5: the owner ran the extended payload block (the template rows, PowerShell rows, D1–D11 with search rows): every line printed PASS. `git check-ignore -v client/.env.production` printed `.gitignore:76:.env.*`.
- Item 6: `git commit -m "hook test"` with nothing staged was blocked through Bash (Phase A, and again in Step E) and through PowerShell; `HEAD` stayed at `3ea34ef`.

Phase B: not started.
