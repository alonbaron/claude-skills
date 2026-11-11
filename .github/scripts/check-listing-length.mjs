// Fails when a skill's listing text is over the cap. The listing text is the frontmatter `description`
// plus `when_to_use`, each folded to one line; the " - " Claude Code puts between them is not counted.
// It is all the model sees of a skill before the skill loads, and Claude Code drops descriptions once
// the whole listing is over its budget (by default 1% of the context window), so each skill stays small.
// Run from the repo root: node .github/scripts/check-listing-length.mjs
import { readdirSync, readFileSync } from 'node:fs'

const CAP = 600
// A skill listed here may pass CAP, up to its own ceiling. Each ceiling is the measured length of the
// text that passed the evals, so that text cannot grow again without this file changing too.
const CEILING = {
  // Vendored from DietrichGebert/ponytail. Cut to 568, the skill stopped loading in two eval cases (run 43083796116).
  ponytail: 1049,
  // The security hand-off clause. Without it the final answer stopped naming /security-review (run 43083796116).
  'review-swarm': 671,
}

// One frontmatter value as a single line: a plain or quoted scalar, or a block scalar (`>-`, `|`) with
// its indented lines joined by spaces.
function field(frontmatter, key) {
  const m = frontmatter.match(new RegExp(`^${key}:[ \\t]*(.*)\\n((?:(?:[ \\t]+.*)?\\n)*)`, 'm'))
  if (!m) return ''
  const first = /^[>|][+-]?$/.test(m[1].trim()) ? '' : m[1].trim().replace(/^(["'])(.*)\1$/, '$2')
  return [first, ...m[2].split('\n')].map((line) => line.trim()).filter(Boolean).join(' ')
}

let failed = false
for (const skill of readdirSync('skills').sort()) {
  const file = `skills/${skill}/SKILL.md`
  const frontmatter = readFileSync(file, 'utf8').replace(/\r\n/g, '\n').match(/^---\n([\s\S]*?\n)---\n/)
  const description = frontmatter ? field(frontmatter[1], 'description') : ''
  if (!description) {
    console.log(`${file}: no frontmatter description found`)
    failed = true
    continue
  }
  const whenToUse = field(frontmatter[1], 'when_to_use')
  const total = description.length + whenToUse.length
  const cap = CEILING[skill] ?? CAP
  const over = total > cap
  if (over) failed = true
  console.log(
    `${skill.padEnd(18)} description ${String(description.length).padStart(4)} + when_to_use ` +
      `${String(whenToUse.length).padStart(4)} = ${String(total).padStart(4)} of ${cap}${over ? '  OVER' : ''}`,
  )
}
process.exit(failed ? 1 : 0)
