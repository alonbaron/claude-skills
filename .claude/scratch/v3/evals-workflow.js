export const meta = {
  name: 'skills-v3-evals',
  description: 'Author the claude-plugin-eval behavioral suite for the six skills (fixtures, prompts, graders), then verify format',
  phases: [
    { title: 'Author', detail: 'one author per skill writes its eval cases under evals/' },
    { title: 'Check', detail: 'one checker per skill validates format, regexes, scaffolds' },
  ],
}

const REPO = 'C:/Users/alonb/Desktop/Code/claude-skills'
const AUDIT = 'C:/Users/alonb/AppData/Local/Temp/claude/c--Users-alonb-Desktop-Code-claude-skills/6eac8a11-e91e-4e8d-8391-0d9d9a6adbc7/scratchpad/audit'
const PROBE = 'C:/Users/alonb/AppData/Local/Temp/claude/c--Users-alonb-Desktop-Code-claude-skills/6eac8a11-e91e-4e8d-8391-0d9d9a6adbc7/scratchpad/probe-plugin'
const SKILLS = ['architect', 'ask-the-council', 'ponytail', 'prompt-generator', 'review-swarm', 'up-to-date']

const FORMAT = `
EVAL FORMAT (verified against code.claude.com/docs/en/plugin-evals and two probe runs on this machine today; a working example suite is at ${PROBE}/evals — read it first):
- One directory per case under ${REPO}/evals/<skill>/<case-name>/ (nesting under a non-case directory groups cases). A case needs prompt.md; case.yaml only when it needs context.* fields.
- prompt.md frontmatter keys allowed (unknown keys are an error): name, description, tags, runs, expected_outcome, model, max_turns (default 10, max 200), timeout_seconds (default 300, max 3600), allowed_tools (read-only set: Read, Glob, Grep, Skill, Agent, TodoWrite), append_system_prompt, env. Body = the prompt verbatim.
- case.yaml (when used): schema_version: "1.1", name, and context: { scaffold_script: fixture.sh, add_dirs: [dir] }. The scaffold script is bash, runs in the empty workspace before Claude starts, only with --scaffold; git init/commit work (verified). Prefer scaffold over add_dirs for anything git-related.
- graders/<name>.md, frontmatter type + options, body = rubric for llm:
  type: llm  (body: "PASS if ... FAIL if ..."; optional focus: last_message (default) | trace | { source: file, path: X }; weight: n)
  type: tool_used  (tool: Skill|Agent|Read|..., input_match: JS regex over the JSON-encoded tool input, min (default 1), max; arm: both|with-only)
  type: regex  (pattern, flags, match: contains|not_contains|"count:N", target: last_message|trace|files|{source: file, path})
  type: file_exists (path glob, exists: true|false; only files created during the run)
- Runs are isolated: no user CLAUDE.md, no other skills or plugins; only alon-skills is loaded. Skills fire as "alon-skills:<name>", so the skill-fired grader is: type: tool_used, tool: Skill, input_match: '"skill"\\s*:\\s*"(?:[\\w-]+:)?<name>"'. Mark it arm: both only for must-NOT-fire cases (with min: 0, max: 0); for must-fire cases omit arm (it becomes a plugin-fired indicator).
- On this Windows machine Bash cannot be granted to the agent under test (no sandbox backend). The suite will be run with --allow-tools Write Edit --scaffold --judge-model sonnet --model claude-fable-5-1. So: the model can Read/Grep/Glob, spawn Agent subagents, Write and Edit files, but cannot run git or shell. The skills' own injected context blocks DO run (verified): up-to-date's injection gives it git status/fetch/rev-list/log output; review-swarm's gives git status --short and diff --stat of the working tree; architect's lists which doc files exist. Design every case so the skill can do its job with those tools only: e.g. a review-swarm fixture leaves the change UNCOMMITTED so the injection shows it and reviewers Read the files; an up-to-date fixture creates a real remote (git init --bare in a mktemp -d directory, then git clone <that> . into the empty workspace, push commits, then git reset --hard HEAD~N to be behind, and append to a tracked file to be dirty).
- A subagent's Agent-tool input is JSON with "model":"opus" etc., so model routing is checked with type: tool_used, tool: Agent, input_match: '"model"\\s*:\\s*"opus"', min: N.
- Each llm grader must be a concrete PASS/FAIL rubric a Sonnet judge can apply to the final message (or to the trace when focus: trace is set, in which case the judge sees the first 12 and last 12 messages). Short outputs judged by llm; anything long or file-shaped judged by regex over the file.
- results/ is written by runs: the repo .gitignore must contain "evals/**/results/" (the checker verifies it exists at ${REPO}/.gitignore; create it if missing).`

const SKILL_BEHAVIOR = `
WHAT THE v3 SKILLS DO (the cases grade this behavior; read ${REPO}/skills/<skill>/SKILL.md for the current text, which may be mid-rewrite, and ${AUDIT}/<skill>.json for the analyst's eval_cases plus the refuters' notes on them):
- Every proactive skill announces in one line and proceeds without asking permission.
- Model routing: review-swarm spawns reviewers with model sonnet and verifiers with model opus; ask-the-council spawns advisors with model opus (4 by default, 6 with "deep"); the chairman synthesis is in the main thread. The other four spawn nothing.
- Boundaries that must hold: review-swarm declines trivial diffs (suggests a single pass or /code-review), hands security-only asks to /security-review, never edits files; ask-the-council declines reversible/low-stakes calls and answers directly; ponytail never simplifies trust boundaries, defers tidying of an already-written diff to /simplify, fixes root causes across all callers; prompt-generator does not fire for human-facing prose and suggests architect for whole-build asks; architect makes a targeted addition when docs already exist, cites both sides in audit mode, asks at most 3 blocking questions; up-to-date never pulls on a dirty tree, never reports "in sync" when the upstream comparison failed, says "no remote" in one line and starts the task when there is no remote.
- Rules every skill carries: never invent paths/APIs/facts; commits are the repo owner's alone.`

const AUTHOR_SCHEMA = {
  type: 'object', required: ['skill', 'cases'],
  properties: { skill: { type: 'string' }, cases: { type: 'array', items: { type: 'object', required: ['name', 'dir', 'kind', 'graders', 'scaffold'], properties: { name: { type: 'string' }, dir: { type: 'string' }, kind: { type: 'string', enum: ['must-fire', 'must-not-fire'] }, graders: { type: 'array', items: { type: 'string' } }, scaffold: { type: 'boolean' } } } } },
}
const CHECK_SCHEMA = {
  type: 'object', required: ['skill', 'verdict', 'fixed', 'remaining'],
  properties: { skill: { type: 'string' }, verdict: { type: 'string', enum: ['pass', 'fixed', 'fail'] }, fixed: { type: 'array', items: { type: 'string' } }, remaining: { type: 'array', items: { type: 'string' } } },
}

const author = (skill) => agent(`You are authoring the behavioral eval cases for the skill "${skill}" in the alon-skills plugin.
${FORMAT}
${SKILL_BEHAVIOR}

Write 3 cases (4 for ponytail: add a root-cause case with a scaffold that creates one shared helper called from three call sites and a bug report naming only one path; grade that the fix lands in the shared helper) under ${REPO}/evals/${skill}/<case-name>/. Take the analyst's eval_cases in ${AUDIT}/${skill}.json as the starting point, apply the refuters' notes, and make each prompt something a real user types (stack, situation, concrete detail; never name the skill unless the analyst's case does). Every case gets: a skill-fired tool_used grader; one grader on the result (llm PASS/FAIL, or regex over a produced file); where the behavior is a process fact (model routing, no subagents spawned, no file edits) a tool_used grader on Agent/Edit/Write. Use max_turns 40 and timeout_seconds 900 for skills that spawn subagents or write doc sets, 15/300 otherwise. Write scaffold fixture.sh files for any case that needs repo state; keep fixtures tiny (a few files, real git commits, committer identity set with -c user.name/-c user.email), and make them idempotent in an empty directory. Do not write results/ directories. Return only the structured object listing what you wrote.`, { label: `author:${skill}`, phase: 'Author', schema: AUTHOR_SCHEMA })

const check = (a) => agent(`You are checking eval cases for format errors before they are run (a bad key fails the whole suite load).
${FORMAT}

Cases to check, under ${REPO}/evals/${a.skill}/: ${a.cases.map(c => c.dir).join(', ')}.
For each file: frontmatter keys are only the allowed ones with the right spelling; YAML parses; every regex in input_match/pattern is a valid JavaScript regex and, for skill-fired graders, matches "alon-skills:${a.skill}" and "${a.skill}" (test it with node -e); must-not-fire graders have min: 0, max: 0 and arm: both; llm rubrics state PASS and FAIL; scaffold scripts start with a bash shebang, use only bash + git, and would succeed in an empty directory (dry-run them in a mktemp -d directory with bash and confirm; on this machine bash is Git Bash); case.yaml has schema_version "1.1" and name equal to the directory name. Fix what you can in place with Edit and list it; list anything you could not fix. Also ensure ${REPO}/.gitignore contains the line evals/**/results/ (add it if missing). Return only the structured object.`, { label: `check:${a.skill}`, phase: 'Check', schema: CHECK_SCHEMA })

const out = await pipeline(SKILLS, s => author(s), a => a ? check(a) : null)
const ok = out.filter(Boolean)
log(`${ok.length}/6 skill suites checked: ${ok.map(r => `${r.skill}=${r.verdict}`).join(', ')}`)
return ok