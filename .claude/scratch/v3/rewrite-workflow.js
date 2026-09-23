export const meta = {
  name: 'skills-v3-rewrite',
  description: 'Rewrite the six SKILL.md files for Fable 5.1 from the verified specs; verify each against the decisions; fix once',
  phases: [
    { title: 'Write', detail: 'one writer per skill rewrites SKILL.md in place' },
    { title: 'Verify', detail: 'one verifier per file checks decisions, frontmatter, kept rules, char counts' },
    { title: 'Fix', detail: 'writer amends must-fix items, verifier re-checks' },
  ],
}

const REPO = 'C:/Users/alonb/Desktop/Code/claude-skills'
const AUDIT = 'C:/Users/alonb/AppData/Local/Temp/claude/c--Users-alonb-Desktop-Code-claude-skills/6eac8a11-e91e-4e8d-8391-0d9d9a6adbc7/scratchpad/audit'
const SKILLS = ['architect', 'ask-the-council', 'ponytail', 'prompt-generator', 'review-swarm', 'up-to-date']

const DECISIONS = `
CROSS-CUTTING DECISIONS (final, already adjudicated by two refuters per skill; do not relitigate):
D1 Frontmatter keys, exact spelling: name, description, when_to_use, argument-hint, plus only where listed below: effort, allowed-tools, disallowed-tools, license. description = capability only, <= 450 chars, key use case first. when_to_use = proactive situations, trigger phrases, and the not-for list, <= 800 chars. Combined <= 1,300 chars (the listing truncates description+when_to_use together at 1,536). Use YAML block scalars (>-) for long values.
D2 Global rules block: delete the "## Global rules" section. In its place every skill except prompt-generator carries exactly ONE line inside its Rules or Boundaries section: "Verify or say you don't know; never invent a path, API, number, or fact. Commits are the repo owner's alone: no AI co-author trailer, no AI mention in messages." The plugin is public; installers without a CLAUDE.md still need those two rules, which the base model does not follow on its own. prompt-generator keeps its "Rules every generated prompt must carry" section intact because it is payload for the generated prompt.
D3 effort: write "effort: max" on architect, ask-the-council and review-swarm only (judgment-heavy; the pin keeps them at max when a session is dialed down; never "high", which would downgrade a max session). No effort key on ponytail (it persists across the session), prompt-generator, up-to-date.
D4 allowed-tools only where it pre-approves gated commands the skill always runs, in the documented syntax, space-separated entries with a trailing " *" wildcard, e.g. "allowed-tools: Bash(git status *) Bash(git diff *)". Read, Grep, Glob and Agent are not permission-gated, so never list them.
   review-swarm: Bash(git status *) Bash(git diff *) Bash(git merge-base *) Bash(git log *)
   up-to-date: Bash(git rev-parse *) Bash(git remote *) Bash(git branch *) Bash(git status *) Bash(git stash list*) Bash(git fetch *) Bash(git rev-list *) Bash(git log *) Bash(gh pr list *) Bash(gh issue list *)
   none on the other four.
D5 disallowed-tools: review-swarm only: "disallowed-tools: Edit Write NotebookEdit" (review never fixes; the restriction clears on the next user message, which is when a "fix it" ask would arrive).
D6 Context injection: a line beginning with !\` at the top of the body runs before the model sees the skill; a non-zero exit aborts the invocation, so every command is guarded so failure becomes text. Exactly these, and one sentence under the line saying what the block is:
   review-swarm: !\`git status --short 2>&1; echo "--- diff --stat (working tree)"; git --no-pager diff --stat 2>&1; true\`
   up-to-date, one line, commands in this order each followed by " 2>&1 || true;": git rev-parse --show-toplevel; git remote -v; git branch --show-current; git status --short; git stash list; git fetch --all --prune; git rev-list --left-right --count @{upstream}...HEAD; git log --oneline -15; gh pr list --limit 20; gh issue list --limit 20. Put an echo "--- <name>" before each so the sections are labeled. The body then reasons over that output: a failed rev-list (no upstream or detached HEAD) appears as git's error text and must be reported as "no upstream, unpushed branch" with a fallback comparison against origin/<default>, never as "in sync". Because the git and gh calls are injected, the body no longer instructs the model to run them as tool calls; it instructs it to read the block and run a command again only if the block shows it failed for a transient reason.
   architect: !\`ls -1 SOURCE_OF_TRUTH.md ARCHITECTURE_ROADMAP.md TODO_WORKFLOW.md CLAUDE.md docs/architecture 2>/dev/null || true\` so create-vs-audit mode is known before the first tool call; no git commands (up-to-date owns git state).
   none on ask-the-council, ponytail, prompt-generator; do not mention injection there.
D7 Model routing, written into the body as a rule with its why: review-swarm reviewers are spawned with the Agent tool's model parameter set to sonnet and verifiers to opus; ask-the-council advisors and the deep critique round with opus; the chairman/synthesis runs in the main thread and is never a subagent. Say it is portable because the spawn names the model, so it does not depend on any installer's default subagent model. The other four skills spawn nothing.
D8 Body style for Fable 5.1: judgment rules with the why; no numbered procedures where the order is obvious from the rules; keep every boundary, hand-off, and taste rule that the spec's "keep" list names, verbatim or near-verbatim; keep exact commands as ground truth. Keep the file's existing voice. Target body length: <= 110 lines, ponytail <= 130, architect <= 160 (it carries a template).
D9 Accepted per-skill amendments:
   architect: keep both clauses of the Rules line (defined responsibility AND a failure mode per component); add the clause that an existing doc set missing one fact gets the one invariant or section added, not a re-authored set; add a "## Commands" section to the CLAUDE.md template (a table Scope | Install | Test | Lint | Format, one row for the root and one per package, with any package-manager quirk stated) and the "Left for <id>: ..." note convention to the TODO_WORKFLOW.md description, both because the plugin's build-loop workflow reads them; name docs/handoff.md as the loop's newest-first log that close writes.
   ask-the-council: keep the fixed default 4 / deep 6 seats exactly; Process becomes prose; drop the allowed-tools idea.
   ponytail: cut the Persistence section and the Proactive-use restatement of triggers (one announce line stays), keep the toggle rule ("stop ponytail"/"normal mode", level sticks) in Boundaries, add the line that an already-written working diff that needs tidying is /simplify's job, keep "license: MIT".
   prompt-generator: Process becomes prose; keep "Rules every generated prompt must carry" intact; in when_to_use say "just write it" for human-facing prose instead of naming humanizer; do not add the "payload not meta" sentence.
   review-swarm: keep all three Rules (real file:line, a clean dimension gets one line, do not fix here: offer the ranked list to an implementer or /code-review --fix); add the sentence "Never report a finding that has not been through the verifier pass."; keep the Relationship to built-ins section; keep the size guard.
   up-to-date: keep the one-line announce-before-running rule, the sync decision verbatim (clean+behind offer ff-only pull on confirm; diverged explain and ask; dirty never pull), the no-upstream rule, "report only what commands returned"; drop Done when; keep the docs-arg step (context7) as one line.
D10 Every proactive skill keeps its announce line: "Running <skill>: <why>" (or the skill's existing phrasing) in one line, no permission asked.`

const WRITE_SCHEMA = {
  type: 'object', required: ['skill', 'path', 'description_chars', 'when_to_use_chars', 'body_lines', 'frontmatter_keys', 'notes'],
  properties: {
    skill: { type: 'string' }, path: { type: 'string' },
    description_chars: { type: 'integer' }, when_to_use_chars: { type: 'integer' }, body_lines: { type: 'integer' },
    frontmatter_keys: { type: 'array', items: { type: 'string' } },
    notes: { type: 'array', items: { type: 'string' }, description: 'judgment calls you made that a reviewer should know, max 6' },
  },
}
const VERIFY_SCHEMA = {
  type: 'object', required: ['verdict', 'must_fix', 'nits'],
  properties: {
    verdict: { type: 'string', enum: ['pass', 'fix'] },
    must_fix: { type: 'array', items: { type: 'object', required: ['what', 'where'], properties: { what: { type: 'string' }, where: { type: 'string', description: 'line or section' } } } },
    nits: { type: 'array', items: { type: 'string' } },
  },
}

const write = (skill) => agent(`You are rewriting one Claude Code skill file in place for its v3 release, tuned for the Fable 5.1 model.
${DECISIONS}

Inputs to read fully before writing:
- Current file: ${REPO}/skills/${skill}/SKILL.md (this is what you overwrite)
- Verified spec and two refutations: ${AUDIT}/${skill}.json (fields: spec = the analyst's proposal; grounding and collisions = refuters' strike/amend/missing lists). Apply the spec EXCEPT where a refuter struck or amended it, and except where DECISIONS above override both.
- Siblings for hand-off consistency: the other five files under ${REPO}/skills/*/SKILL.md (skim).

Write the new ${REPO}/skills/${skill}/SKILL.md with the Write tool. Then count: description chars, when_to_use chars, body lines (after the closing --- of the frontmatter). Return only the structured object.`, { label: `write:${skill}`, phase: 'Write', schema: WRITE_SCHEMA })

const verify = (skill, round) => agent(`You are verifying a rewritten skill file against its decisions. Be strict: a must_fix is anything that violates a DECISION, drops a "keep" item from the spec, uses an invalid frontmatter key or syntax, or would abort on injection.
${DECISIONS}

Read: the new file ${REPO}/skills/${skill}/SKILL.md; the original via the command "git -C ${REPO} show HEAD:skills/${skill}/SKILL.md"; the spec's keep list and both refuters' lists in ${AUDIT}/${skill}.json.
Check: (1) every DECISION that applies to this skill (D1-D10) is satisfied literally; (2) every item in spec.keep survives in substance; (3) frontmatter parses as YAML (keys exactly as D1; no argument_hint with underscore; block scalars closed); (4) description <= 450 chars, when_to_use <= 800, combined <= 1,300 (count them yourself); (5) the injection line, if any, matches D6 and every command is guarded; (6) hand-offs name skills that exist (architect, ask-the-council, ponytail, prompt-generator, review-swarm, up-to-date, ux-designer, humanizer, /simplify, /code-review, /security-review); (7) no Alon-only paths or repo names; (8) body length within D8. Round ${round}.
Return only the structured object.`, { label: `verify:${skill}:r${round}`, phase: round === 1 ? 'Verify' : 'Fix', schema: VERIFY_SCHEMA })

const fix = (skill, mustFix) => agent(`You are amending a rewritten skill file. Apply ONLY the must-fix items below to ${REPO}/skills/${skill}/SKILL.md with the Edit tool (read it first); change nothing else.
${DECISIONS}

MUST FIX:
${mustFix.map((m, i) => `${i + 1}. ${m.where}: ${m.what}`).join('\n')}

Return only the structured object with the recounted numbers.`, { label: `fix:${skill}`, phase: 'Fix', schema: WRITE_SCHEMA })

const results = await pipeline(SKILLS,
  s => write(s),
  async (w, s) => {
    if (!w) return { skill: s, written: false }
    const v1 = await verify(s, 1)
    if (!v1) return { skill: s, written: true, verify: null }
    if (v1.verdict === 'pass') return { skill: s, written: true, verify: v1, fixed: false }
    log(`${s}: ${v1.must_fix.length} must-fix items, amending`)
    const f = await fix(s, v1.must_fix)
    const v2 = await verify(s, 2)
    return { skill: s, written: true, verify: v1, fixed: Boolean(f), reverify: v2 }
  },
)
const out = results.filter(Boolean)
log(`${out.filter(r => r.written).length}/6 written; ${out.filter(r => (r.reverify || r.verify)?.verdict === 'pass').length} pass verification`)
return out