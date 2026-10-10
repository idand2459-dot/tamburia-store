#!/usr/bin/env node
// Guardrail hook, run before every shell command the agent issues.
// Blocks destructive shell patterns before they run, even if the agent's plan or
// prompt would have allowed the command, and even when permission prompts are bypassed.

// Access to env/secret FILES is handled by block-secret-file-access.mjs, which
// runs on every tool. Do not add a bare /\.env\b/ rule here: it also matches
// `process.env`, `import.meta.env` and `$env:`, which blocked ordinary commands.
const DENY_PATTERNS = [
  // rm with both a recursive and a force flag, in any order or split form:
  // `rm -rf`, `rm -fr`, `rm -r -f`, `rm -Rf`, `rm -rfv x`
  /\brm\b(?=[^;&|\n]*\s-[a-z]*r)(?=[^;&|\n]*\s-[a-z]*f)/i,
  /\bgit\s+push\s+--force/i,
  /\bgit\s+reset\s+--hard/i,
  /\bDROP\s+(TABLE|DATABASE)\b/i,
  // DELETE with no WHERE clause, also when quoted or schema-qualified:
  // `psql -c "DELETE FROM users"`, `DELETE FROM public.users;`
  /\bdelete\s+from\s+[\w.]+\s*;?\s*["']?\s*;?\s*$/i
]

// Destructive commands specific to this project's stack (for example a database reset
// or a cloud resource delete), added during adaptation as one regular expression per
// entry. Leave the list empty if there are none.
//
// A project command must start a command segment (the start of the command, or after
// `;`, `&`, `|`, `(` or a newline), so a search such as `grep "seed:demo" README.md`
// is not blocked. The SQL rule (TRUNCATE) cannot be anchored, because SQL usually sits
// inside a quoted `psql -c` string, so it also blocks a search for the word.
const START = String.raw`(?:^|[;&|(\n])\s*`
const startsWith = body => new RegExp(START + body, 'i')

const PROJECT_DENY_PATTERNS = [
  // Demo data: seed:demo inserts into the real catalogue database, seed:demo:clear deletes
  startsWith(String.raw`npm\s+run\s+seed:demo(?![\w-])`),
  startsWith(String.raw`node\s+\S*seed-demo\.js`),
  // Catalogue import: inserts and overwrites products, with no flag needed
  startsWith(String.raw`npm\s+run\s+products:import(?![\w-])`),
  startsWith(String.raw`node\s+\S*import-products\.js`),
  // Write modes of the photo-day scripts; their dry runs stay allowed
  startsWith(String.raw`(?:npm\s+run\s+products:import-new|node\s+\S*products-import-new\.js)\b[^;&|\n]*\s--(?:apply|revert)\b`),
  startsWith(String.raw`(?:npm\s+run\s+products:hide-unphotographed|node\s+\S*products-hide-unphotographed\.js)\b[^;&|\n]*\s--(?:apply|revert)\b`),
  startsWith(String.raw`(?:npm\s+run\s+images:products|node\s+\S*images-products\.js)\b[^;&|\n]*\s--(?:apply|revert)\b`),
  // PostgreSQL: drop a whole database
  startsWith(String.raw`dropdb\b`),
  // git clean of ignored files would delete uploads/ and uploads-originals/
  startsWith(String.raw`git\b[^;&|\n]*\sclean\b[^;&|\n]*\s-[a-z]*x`),
  // Any git clean, also the dry run: until they are committed, new files are untracked.
  // Only global options may come before the subcommand, so `git log --grep clean` passes.
  startsWith(String.raw`git(?:\s+(?:-C|-c|--git-dir|--work-tree|--namespace)\s+\S+|\s+-\S+)*\s+clean\b`),
  // PowerShell and its aliases, recursive delete: `Remove-Item x -Recurse`, `rm -r x`
  startsWith(String.raw`(?:Remove-Item|rm|ri|rmdir|rd|del|erase)\b[^;&|\n]*\s-r[a-z]*\b`),
  // cmd recursive delete: `rd /s x`, `del /s x`, also through `cmd /c`
  startsWith(String.raw`(?:cmd(?:\.exe)?\s+/c\s+["']?)?(?:rd|rmdir|del|erase)\b[^;&|\n]*\s/s\b`),
  /\bTRUNCATE\s+(?:TABLE\s+)?["\w.]+/i
]

let input = ''
process.stdin.on('data', chunk => { input += chunk })
process.stdin.on('end', () => {
  let payload
  try {
    payload = JSON.parse(input)
  } catch {
    process.exit(0)
  }

  const command = payload?.tool_input?.command ?? ''
  const match = [...DENY_PATTERNS, ...PROJECT_DENY_PATTERNS].find(pattern => pattern.test(command))

  if (match) {
    console.error(`[guardrail] Blocked command matching ${match}: ${command}`)
    process.exit(2) // exit code 2 = block the tool call
  }

  process.exit(0)
})
