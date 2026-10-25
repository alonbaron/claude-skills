// Runs the shipped slim child (journal.ts slimCommand) through this machine's real Windows PowerShell or perl, the way
// readSlimmed does, on generated logs and on any real logs named as arguments. Node 24 or later (it imports journal.ts).
//   node mods/workflow-watch/tests/slim-check.mjs [--perl <path>] [log.jsonl ...]
// --perl runs the perl child even where readSlimmed would use PowerShell.
// Exits 1 when a guarantee breaks: exit 0, output under the 4 MiB read limit, every line JSON, no string past 2003
// characters, the newest lines kept, and parseSession reading the result.
import { spawnSync } from 'node:child_process'
import { mkdtempSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const { parseSession, slimCommand } = await import('../hooks/journal.ts')

const READ_LIMIT = 4 * 1024 * 1024
const TIMEOUT_MS = 20000
const args = process.argv.slice(2)
const perlAt = args.indexOf('--perl')
const perl = perlAt >= 0 ? args.splice(perlAt, 2)[1] : 'perl'
// --perl takes the non-Windows branch even on Windows, so a Windows machine can check a perl too.
const systemRoot = perlAt >= 0 ? undefined : process.env.SystemRoot

const line = o => JSON.stringify(o)
const at = n => new Date(Date.parse('2026-10-22T08:00:00.000Z') + n * 1000).toISOString()
const BASE64 = Buffer.from(Array.from({ length: 240000 }, (_, i) => (i * 7919) % 256)).toString('base64')
const HEBREW = 'שלום, זה בדיקה של טקסט בעברית — '
const ESCAPED = 'a "quoted" \\ path\nline two\t'

/** A session of `turns` turns; every 20th carries a 320k base64 image and a 150k string, every one 1900-char results. */
function session(turns) {
  const out = []
  for (let k = 1; k <= turns; k++) {
    const t = k * 10
    out.push(line({ type: 'api-request', body: 'x'.repeat(5000) }))
    out.push(line({ parentUuid: `p${k}`, type: 'user', timestamp: at(t), message: { role: 'user', content: `turn ${k}: ${HEBREW}please check` } }))
    out.push(line({ parentUuid: `a${k}`, type: 'assistant', timestamp: at(t + 1), message: { model: 'claude-opus-5-5', stop_reason: 'tool_use', content: [{ type: 'thinking', thinking: ESCAPED.repeat(k % 20 === 0 ? 6000 : 50) }, { type: 'tool_use', id: `tu${k}`, name: 'Read', input: { file_path: '/x/a.png' } }] } }))
    const results = Array.from({ length: 4 }, () => ({ type: 'tool_result', tool_use_id: `tu${k}`, content: (HEBREW + ESCAPED).repeat(48).slice(0, 1900) }))
    if (k % 20 === 0) results.push({ type: 'tool_result', tool_use_id: `tu${k}`, content: [{ type: 'image', source: { type: 'base64', data: BASE64 } }] })
    out.push(line({ parentUuid: `r${k}`, type: 'user', timestamp: at(t + 2), message: { content: results }, toolUseResult: k % 20 === 0 ? { type: 'image', file: { base64: BASE64 } } : { stdout: 'ok' } }))
    out.push(line({ parentUuid: `m${k}`, type: 'attachment', timestamp: at(t + 3), attachment: { type: 'total_tokens_reminder', content: 'y'.repeat(300) } }))
    out.push(line({ parentUuid: `e${k}`, type: 'assistant', timestamp: at(t + 4), message: { model: 'claude-opus-5-5', stop_reason: 'end_turn', content: [{ type: 'text', text: `done ${k} ✓` }] } }))
  }
  return `${out.join('\n')}\n`
}

let failed = 0
const check = (ok, what) => {
  if (!ok) failed++
  return ok ? '' : ` FAIL(${what})`
}

/** Slims `file` with the shipped child and checks the result; `want` names the first and last prompts expected. */
function run(file, want) {
  const { argv, env } = slimCommand(file, systemRoot, perl)
  const started = Date.now()
  const r = spawnSync(argv[0], argv.slice(1), { env: { ...process.env, ...env }, maxBuffer: 1 << 30, timeout: TIMEOUT_MS * 3 })
  const ms = Date.now() - started
  if (r.error) {
    failed++
    return console.log(`FAIL ${file}: ${r.error.message}`)
  }
  const text = r.stdout.toString('utf8')
  const lines = text.split('\n').filter(l => l.trim())
  let bad = 0
  let longest = 0
  const walk = v => {
    if (typeof v === 'string') longest = Math.max(longest, v.length)
    else if (v && typeof v === 'object') for (const k in v) walk(v[k])
  }
  for (const l of lines) {
    try {
      walk(JSON.parse(l))
    } catch {
      bad++
    }
  }
  let prompts = []
  let parseError = ''
  try {
    prompts = parseSession(text, Date.now()).filter(s => s.kind === 'turn').map(s => s.prompt)
  } catch (e) {
    parseError = String(e)
  }
  let verdict = ''
  verdict += check(r.status === 0, `exit ${r.status}`)
  verdict += check(r.stderr.length === 0, `stderr ${r.stderr.toString().slice(0, 120)}`)
  verdict += check(r.stdout.length > 0 && r.stdout.length <= READ_LIMIT, `${r.stdout.length} bytes`)
  verdict += check(ms <= TIMEOUT_MS, `${ms} ms`)
  verdict += check(bad === 0, `${bad} lines not JSON`)
  verdict += check(longest <= 2003, `string of ${longest}`)
  verdict += check(!parseError, parseError)
  if (want?.last) verdict += check(prompts.at(-1)?.startsWith(want.last) === true, `last prompt ${prompts.at(-1)}`)
  if (want?.first) verdict += check(prompts[0]?.startsWith(want.first) === true, `first prompt ${prompts[0]}`)
  console.log(`${verdict ? 'FAIL' : 'ok  '} ${statSync(file).size} -> ${r.stdout.length} bytes, ${lines.length} lines, ${prompts.length} turns, ${ms} ms${verdict} ${file}`)
}

const dir = mkdtempSync(join(tmpdir(), 'slim-check-'))
try {
  const tool = systemRoot ? 'Windows PowerShell' : spawnSync(perl, ['-e', 'print "perl $^V"']).stdout?.toString() || `${perl} (not found)`
  console.log(`${process.platform} ${tool}`)
  const small = join(dir, 'small.jsonl')
  writeFileSync(small, session(40))
  run(small, { first: 'turn 1:', last: 'turn 40:' })
  const big = join(dir, 'big.jsonl')
  writeFileSync(big, session(400))
  run(big, { last: 'turn 400:' })
  for (const file of args) run(file)
} finally {
  rmSync(dir, { recursive: true, force: true })
}
process.exit(failed ? 1 : 0)
