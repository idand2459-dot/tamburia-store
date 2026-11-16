/**
 * The smallest possible test harness for the browser suite, in the same style as the smoke
 * suites (a `check` per assertion). It keeps four separate counters, because a test that did not
 * run must never be reported as one that passed:
 *
 *   passed  - the assertion held
 *   failed  - the assertion did not hold, or a scenario threw
 *   skipped - the scenario was left out on purpose (skip())
 *   blocked - the scenario could not run because something it needs is missing (block())
 *
 * A scenario that throws is one failure, with the error, and the run goes on to the next one.
 */
const counts = { passed: 0, failed: 0, skipped: 0, blocked: 0 };
const failures = [];
const notRun = [];

/** Records one assertion. */
function check(name, condition, actual) {
  if (condition) {
    counts.passed += 1;
    console.log(`  ✓ ${name}`);
  } else {
    counts.failed += 1;
    failures.push(name);
    console.log(`  ✗ ${name} — קיבלנו: ${JSON.stringify(actual)}`);
  }
}

/** Records a scenario that was left out on purpose. */
function skip(name, reason) {
  counts.skipped += 1;
  notRun.push(`skipped: ${name} (${reason})`);
  console.log(`  ○ דולג: ${name} — ${reason}`);
}

/** Records a scenario that could not run, with what it was missing. */
function block(name, reason) {
  counts.blocked += 1;
  notRun.push(`blocked: ${name} (${reason})`);
  console.log(`  ⊘ נחסם: ${name} — ${reason}`);
}

let abortReason = null;

/** After this, every remaining scenario is reported as blocked with `reason` (the browser went away). */
function abortRun(reason) {
  if (abortReason) return;
  abortReason = reason;
  counts.failed += 1;
  failures.push(reason);
  console.log(`  ✗ ${reason}`);
}

/** Runs one scenario; an exception is a failure of the scenario, not the end of the run. */
async function scenario(title, body) {
  console.log(`\n── ${title}`);
  try {
    await body();
  } catch (err) {
    counts.failed += 1;
    failures.push(`${title} (threw)`);
    console.log(`  ✗ התרחיש קרס — ${err && err.stack ? err.stack.split('\n').slice(0, 4).join('\n    ') : err}`);
  }
}

/** Prints the totals and returns the exit code. */
function summary() {
  console.log('\n═══ סיכום E2E ═══');
  console.log(`  עברו: ${counts.passed}  נכשלו: ${counts.failed}  דולגו: ${counts.skipped}  נחסמו: ${counts.blocked}`);
  for (const line of notRun) console.log(`  - ${line}`);
  for (const name of failures) console.log(`  ✗ ${name}`);
  return counts.failed === 0 && counts.blocked === 0 ? 0 : 1;
}

module.exports = { check, skip, block, scenario, summary, abortRun, counts };
