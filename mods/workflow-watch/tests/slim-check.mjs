// Runs the shipped slim child (journal.ts slimCommand) through this machine's real Windows PowerShell or perl, the way
// readSlimmed does, on generated logs and on any real logs named as arguments. Node 24 or later (it imports journal.ts).
//   node mods/workflow-watch/tests/slim-check.mjs [--perl <path>] [log.jsonl ...]
// --perl runs the perl child even where readSlimmed would use PowerShell.
// Exits 1 when a guarantee breaks: exit 0 within the read timeout, output under the read limit, every line JSON, no
// string past 2003 characters, a log past SLIM_TAIL cut to just under it behind SLIM_CUT and one under it left whole,
// and parseSession reading the result.
import { spawnSync } from 'node:child_process'
import { mkdtempSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const { READ_LIMIT, SLIM_CUT, SLIM_TAIL, SLIM_TIMEOUT_MS, parseSession, slimCommand } = await import('../hooks/journal.ts')

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

/**
 * A session of `turns` turns. Every turn has four 1900-character results; every 20th also has a 320k base64 image and
 * a 168k string with 24k escapes, past what perl before 5.38 repeats a group for when it goes character by character.
 */
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

/** An edit of a 30000-line file (90k escapes in one string), then a last line still being written when it was read. */
function heavy() {
  const edit = line({ parentUuid: 'h', type: 'user', timestamp: at(100), message: { content: [{ type: 'tool_result', tool_use_id: 'tu6', content: 'ok' }] }, toolUseResult: { originalFile: 'const s = "x";\n'.repeat(30000) } })
  const partial = `{"parentUuid":"z","type":"user","message":{"content":[{"type":"tool_result","content":"${'x\\"'.repeat(100000)}`
  return `${session(6)}${edit}\n${partial}`
}

let failed = 0
const check = (ok, what) => {
  if (!ok) failed++
  return ok ? '' : ` FAIL(${what})`
}

/**
 * Slims `file` with the shipped child and checks the result. `want`: first/last prompt prefixes, the turn count,
 * isCut (whether the tail must or must not have cut), and isPartial (a last line still being written may stay unparsed).
 */
function run(file, want = {}) {
  const { argv, env } = slimCommand(file, systemRoot, perl)
  const started = Date.now()
  const r = spawnSync(argv[0], argv.slice(1), { env: { ...process.env, ...env }, maxBuffer: 1 << 30, timeout: SLIM_TIMEOUT_MS * 3 })
  const ms = Date.now() - started
  if (r.error) {
    failed++
    return console.log(`FAIL ${file}: ${r.error.message}`)
  }
  const text = r.stdout.toString('utf8')
  const lines = text.split('\n').filter(l => l.trim())
  const isCut = lines[0] === SLIM_CUT
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
  const bytes = r.stdout.length
  let verdict = ''
  verdict += check(r.status === 0, `exit ${r.status}`)
  verdict += check(r.stderr.length === 0, `stderr ${r.stderr.toString().slice(0, 120)}`)
  verdict += check(bytes > 0 && bytes <= READ_LIMIT, `${bytes} bytes`)
  verdict += check(ms <= SLIM_TIMEOUT_MS, `${ms} ms`)
  verdict += check(bad <= (want.isPartial ? 1 : 0), `${bad} lines not JSON`)
  verdict += check(longest <= 2003, `string of ${longest}`)
  verdict += check(!parseError, parseError)
  // A cut keeps whole lines, so it lands within one line of SLIM_TAIL; the marker line comes on top.
  if (isCut) verdict += check(bytes > SLIM_TAIL - 64 * 1024 && bytes <= SLIM_TAIL + SLIM_CUT.length + 1, `cut to ${bytes} bytes`)
  if (want.isCut !== undefined) verdict += check(isCut === want.isCut, want.isCut ? 'not cut' : 'cut')
  if (want.turns !== undefined) verdict += check(prompts.length === want.turns, `${prompts.length} turns`)
  if (want.last) verdict += check(prompts.at(-1)?.startsWith(want.last) === true, `last prompt ${prompts.at(-1)}`)
  if (want.first) verdict += check(prompts[0]?.startsWith(want.first) === true, `first prompt ${prompts[0]}`)
  if (want.isCut) verdict += check(prompts[0]?.startsWith('turn 1:') !== true, 'oldest turn kept')
  console.log(`${verdict ? 'FAIL' : 'ok  '} ${statSync(file).size} -> ${bytes} bytes${isCut ? ' (cut)' : ''}, ${lines.length} lines, ${prompts.length} turns, longest ${longest}, ${ms} ms${verdict} ${file}`)
}

const dir = mkdtempSync(join(tmpdir(), 'slim-check-'))
try {
  const tool = systemRoot ? 'Windows PowerShell' : spawnSync(perl, ['-e', 'print "perl $^V"']).stdout?.toString() || `${perl} (not found)`
  console.log(`${process.platform} ${tool}`)
  const fixtures = [
    ['small.jsonl', session(40), { first: 'turn 1:', last: 'turn 40:', turns: 40, isCut: false }],
    ['big.jsonl', session(400), { last: 'turn 400:', isCut: true }],
    ['heavy.jsonl', heavy(), { first: 'turn 1:', last: 'turn 6:', isCut: false, isPartial: true }],
  ]
  for (const [name, text, want] of fixtures) {
    writeFileSync(join(dir, name), text)
    run(join(dir, name), want)
  }
  for (const file of args) run(file)
} finally {
  rmSync(dir, { recursive: true, force: true })
}
process.exit(failed ? 1 : 0)
