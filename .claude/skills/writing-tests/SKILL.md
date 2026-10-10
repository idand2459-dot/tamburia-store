---
name: writing-tests
description: Write or review unit and integration tests. Use when adding tests for a new feature, writing a regression test for a bug fix, deciding what needs coverage, or judging whether a test suite is good enough to ship. Covers required coverage areas, test structure, fixtures, flakiness rules, and PR expectations.
---

# Writing Tests

Applies to unit and integration tests.

## Principles
- Test **behavior**, not implementation details.
- Keep tests deterministic and isolated.
- Fast feedback first: unit tests, integration where needed.
- Every bug fix gets a test when feasible.

## Must be covered
- Domain logic and state transitions.
- API request validation and error responses.
- Auth boundary enforcement.
- Persistence-critical paths and migration-sensitive queries.
- User-facing failure flows for key features.

## Structure
- Clear setup → action → assertion phases.
- Descriptive names that state the expected behavior.
- One primary assertion intent per test.
- No shared mutable state between tests, and no reliance on execution order.

## Data and fixtures
- Minimal fixtures, focused on the scenario.
- Prefer factories/builders over large static fixtures.
- Never embed real secrets, keys, or credentials in test data.

## Reliability
- No flaky tests on mainline branches.
- Mock only unstable external dependencies.
- Freeze or override time and randomness when behavior depends on them.

## PR expectations
- New features ship with a happy-path **and** a failure-path test.
- Bug fixes ship with a regression test that fails before the fix and passes after.
- Update or delete obsolete tests when behavior changes intentionally.

## This repository

| Suite | Location | Command |
|---|---|---|
| Server: unit and smoke, against the real local database | `test/` | `npm test` |
| Client: unit (Jest + Testing Library) | `client/src/js/**/*.test.js`, next to the code | `npm run test:client` |
| Accessibility gate (browser, axe-core; not an end-to-end suite) | `scripts/a11y-audit.js` | `npm run build:client`, then `npm run a11y` |

When a test fails, fix the code — not the test.
