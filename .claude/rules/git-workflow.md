# Git Workflow

## Approval gates — no exceptions
- Never run `git commit`, `git merge`, `git push`, or `git tag` yourself. The guardrail hook blocks them.
- When one is needed, stop and ask the user to approve it; the user runs it. Never retry a blocked command.
- Prepare the work instead: stage changes with `git add` and propose the commit message.

## Branches
- Do implementation work on a dedicated branch, never on `main`.
- Create the branch before executing an approved plan.
- One plan or workstream per branch.
- Lowercase, predictable names, singular domain terms:
  - `feat/<topic>` — new capability
  - `fix/<topic>` — bug fix
  - `chore/<topic>` — maintenance
  - `docs/<topic>` — documentation only

## Commits
- Subject: `type(scope): summary`, lowercase, short. Types: `feat`, `fix`, `docs`, `test`, `style`, `perf`, `refactor`, `chore`. The scope is the area touched: `admin`, `orders`, `client`, `server`, `a11y`, `css`, `scripts`. Example: `feat(admin): the pick list in the order card`.
- One intent per commit. Do not bundle unrelated changes; split a change into one commit per topic.

## Merges
- Merge into `main` through a GitHub pull request from the branch.
- At least one review pass before merge when others are involved.
- Resolve open comments and questions before merging.

## Before a repository is made public
- Set the commit author to the GitHub noreply address, and check the author of every existing commit.
- Scan the full history, not only the current files, for secrets and env files.
- Check every screenshot and image for secrets, personal data, and private URLs.
