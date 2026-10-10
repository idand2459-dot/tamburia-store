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

## DONE
