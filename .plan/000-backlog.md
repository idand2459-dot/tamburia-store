# Prioritized Backlog

Format:
- `- [ ] <title>`
- `- [ ] <title> | <marker>`   optional trailing marker, such as a design link or a scope tag

Add a new item at the end of `Current queue:`, in priority order. When an item is done, tick it (`- [x]`) and move it under `## DONE`.

Current queue:
- [ ] README.md and docs/ARCHITECTURE.md contain exact test counts that go stale; replace them with a general statement or verify them | phase B
- [ ] errorHandler.js:62 adds the stack trace to non-production 5xx responses; decide whether to keep it | phase B
- [ ] Static inline styles: `display: 'none'` in ImportTab.js:39, `fontWeight: 600` in PaintCalculator.js:412, and a hard-coded `'#333'` in PaintCalculator.js:271 and :412 (a possible token violation); move them to partials or confirm they stay | audit
- [ ] npm test and npm run a11y use the real local database (test/run-all.js:2-5); decide on a separate test database, and record the answer in AGENTS.md | phase B
- [ ] Add tests that pin the current behavior before any audit change: the delivery area (server and client), the client delivery fee, the email templates' store details, and the admin statistics and CSV rows | audit F01 F02 F04 F06 F07
- [ ] One source for the delivery area's cities and message, client and server | audit F01
- [ ] The client takes the delivery fee from the server instead of a constant | audit F02
- [ ] Keep the four order-status lists aligned, or plan a shared definition | audit F03
- [ ] One constant for the store's address, phone, and hours in the email templates | audit F04
- [ ] Fix the comments that point to missing files or notes | audit F05
- [ ] Move the admin statistics and CSV rows out of useAdminOrders into pure utils | audit F06
- [ ] Rename exportOrdersToExcel to match the CSV it writes | audit F07
- [ ] The order model checks column names against its own list | audit F08

## DONE
