# Test Baseline

- Date: 2026-10-10
- Commit: af37de197344f74848e85353da897b2acc5bd218
- Command: npm test
- Exit code: 0
- Result: 671 passed, 0 failed, 0 skipped

All 15 suites passed (unit-repo-hygiene, unit-config, unit-order-service, unit-product-service, unit-review-service, unit-money, unit-originals, smoke-fresh-db, smoke-static, smoke-orders, smoke-products, smoke-settings, smoke-reviews, smoke-pigments, smoke-auth). No failing tests. Run time: 25.1 s. The run uses the real local database (localhost, `tamburia`, backed up by the owner the same day) and created no file outside what git ignores.

## Client baseline (P1 of REFACTOR_PLAN.md)

- Date: 2026-11-12
- Commit: 6fe32e6c5ce645b01aecb2d6bdf3cb1eafec8bbf (branch `chore/client-pin-tests`, from `chore/refactor-baseline`)
- Commands: `npm run test:client`, `npm run build:client`
- Result, tests: 12 suites passed, 90 tests passed, 0 failed.
- Result, build: compiled successfully.
- Not measured here: the server suites (`npm test`) and `npm run a11y`. Both need the separate PostgreSQL test database (`TEST_DATABASE_URL`), which is not set up yet; the 2026-10-10 server baseline above predates the privacy and test-isolation changes and the removal of the order-lookup work from this branch.
