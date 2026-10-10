#!/usr/bin/env node
// Guardrail hook, run before every tool call the agent issues.
// Nothing may read a real env file, whichever tool is used to reach it (Read, Edit,
// Write, Bash, Grep, Glob...). permissions.deny only covers the exact tool and pattern
// listed and cannot see inside a shell command string, so this hook inspects the target
// of every call: `cat .env`, `Read(.env)` and `grep -r KEY sub/.env` are caught the same
// way. Hooks run even when permission prompts are bypassed, which is why this rule lives
// in a hook and not in permissions.deny alone.

// Matches a real env file anywhere in the tree, at the root or in any subdirectory:
// `.env` and `.env.<suffix>` (`.env.local`, `.env.staging`, `.env.local.bak`, and globs
// such as `.env.*`). A suffix ending in the template names `.example`, `.sample` or
// `.template` is deliberately NOT matched: that is committed template content that may
// be read and written freely. `.envrc` and `.environment` are other files and are not
// matched either.
const ENV_FILE = String.raw`\.env(?:\.(?!(?:[\w*?-]+\.)*(?:example|sample|template)(?![\w*?.-]))[\w*?.-]+)?(?![\w.-])`
const SECRET_FILE_PATTERN = new RegExp(String.raw`(^|[\/\\])` + ENV_FILE, 'i')
// In a command, `.env` must start a file name. Allowing any word before it would also
// match `process.env.HOME` and `import.meta.env.MODE`, which read no file.
const SECRET_IN_COMMAND_PATTERN = new RegExp(String.raw`(^|[\s"'=/\\])` + ENV_FILE, 'i')

// Only fields that NAME a target are inspected. Deliberately not scanning the
// whole tool_input: a Write's `content` can legitimately mention an env file
// (setup docs, .env.example templates, this hook's own source) without
// touching one — scanning content made the hook unable to edit itself.
// `glob` is a Grep filter that selects which files are read, so it names a target too.
const PATH_FIELDS = ['file_path', 'path', 'notebook_path', 'glob']

let input = ''
process.stdin.on('data', chunk => { input += chunk })
process.stdin.on('end', () => {
  let payload
  try {
    payload = JSON.parse(input)
  } catch {
    process.exit(0)
  }

  const toolInput = payload?.tool_input ?? {}

  const blockedPath = PATH_FIELDS
    .map(field => toolInput[field])
    .find(value => typeof value === 'string' && SECRET_FILE_PATTERN.test(value))

  // A shell command can reach a secret file without ever naming a path field:
  // `cat .env`, `grep -r KEY .env`, `type sub\.env`.
  const command = typeof toolInput.command === 'string' ? toolInput.command : ''
  const blockedCommand = SECRET_IN_COMMAND_PATTERN.test(command)

  if (blockedPath || blockedCommand) {
    console.error(
      `[guardrail] Blocked ${payload?.tool_name ?? 'tool'} call touching an env/secret file` +
      `${blockedPath ? `: ${blockedPath}` : ''}. Use .env.example instead.`
    )
    process.exit(2)
  }

  process.exit(0)
})
