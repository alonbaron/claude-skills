// alon-skills build loop. Runs as /alon-skills:build-loop [N | taskId | {json}] inside a session,
// or one task per fresh `claude -p` process through scripts/autobuild.mjs.
//
// One TODO_WORKFLOW.md row at a time; every stage is a fresh subagent with an empty context:
//   plan     -> pick the next eligible "[ ]" row (or resume a stale "[IN PROGRESS]" one), open the branch
//   scout    -> locate files, symbols, tests and doc sections; locations, never contents
//   spec     -> docs first (SoT -> Roadmap -> NN docs), then <scratch>/<id>/spec.md
//   research -> verify unfamiliar APIs (skipped when the spec lists none)
//   build    -> implement from the spec, run the repo's own commands, micro-commit
//   measure  -> independent diff stats (size, docs-only, trust-boundary paths)
//   refute   -> parallel lenses try to refute "done"; findings merged by evidence-weighted voting
//   arbiter  -> only when a finding the fixer disputed comes back
//   fix      -> address blocking findings, at most maxFixRounds
//   close    -> the only writer of the TODO row and docs/handoff.md; runs on every exit after plan
// Repo contract (the architect skill's templates carry all of it): TODO_WORKFLOW.md with the five status
// strings, SOURCE_OF_TRUTH.md, a "## Commands" table in CLAUDE.md, "Left for <id>: ..." notes, docs/handoff.md.
// State between runs lives in the repo (TODO_WORKFLOW.md, docs/handoff.md, <scratch>/<id>/), never in chat.

export const meta = {
  name: "build-loop",
  description:
    "Unattended build loop over TODO_WORKFLOW.md: plan, scout, spec docs-first, build, refute with parallel lenses, fix, close",
  whenToUse:
    "When the next TODO_WORKFLOW.md rows should be built without supervision in a repo that has the architect doc set. /alon-skills:build-loop [maxTasks | taskId | {json}]",
  phases: [
    { title: "Plan", detail: "pick the next eligible TODO row or resume a stale one; open the branch" },
    { title: "Scout", detail: "locate files, symbols, tests and doc sections" },
    { title: "Spec", detail: "update docs first, then write spec.md" },
    { title: "Research", detail: "verify unfamiliar APIs (skipped when none)" },
    { title: "Build", detail: "implement from the spec with tests and micro-commits" },
    { title: "Measure", detail: "independent diff stats for lens gating" },
    { title: "Refute", detail: "parallel lenses try to refute the build; evidence-weighted merge" },
    { title: "Arbiter", detail: "rules on findings the fixer disputed that came back" },
    { title: "Fix", detail: "address blocking findings, bounded rounds" },
    { title: "Close", detail: "TODO row and docs/handoff.md, sole writer" },
  ],
};

// ---------- arguments ----------
const opts = {
  maxTasks: 3,
  task: null,
  models: {},
  dryRun: false,
  maxFixRounds: 2,
  skipLenses: [],
  scratch: ".claude/scratch/build-loop",
};
if (typeof args === "string" && args.trim()) {
  const a = args.trim();
  if (/^\d+$/.test(a)) opts.maxTasks = Number(a);
  else if (a.startsWith("{")) {
    try {
      Object.assign(opts, JSON.parse(a));
    } catch {
      log(`ignoring unparsable JSON args: ${a}`);
    }
  } else {
    // Any other string is a task id; no numbering scheme is assumed.
    opts.task = a;
    opts.maxTasks = 1;
  }
} else if (args && typeof args === "object") {
  Object.assign(opts, args);
}
if (opts.task && !(args && typeof args === "object" && "maxTasks" in args)) opts.maxTasks = 1;
opts.scratch = String(opts.scratch).replace(/\/+$/, "");

// Model tiers. Aliases, not pinned IDs, so each stage follows the newest model of its tier
// (measured 2026-09-23 on CLI 2.1.280: fable = Fable 5.1, opus = Opus 5.5, sonnet = Sonnet 5, haiku = Haiku 4.5).
//   fable  - the decisions everything downstream inherits: which row, what "done" means, who is right in a dispute
//   opus   - deep review and repair: invariants, what the spec missed, fixing what the builder got wrong
//   sonnet - volume work: building, broad review lenses, research, bookkeeping
//   haiku  - mechanical reads: locating files, counting the diff
// Override per stage with {"models":{"build":"opus"}} (in-session) or the driver's config file.
const M = Object.assign(
  {
    plan: "fable",
    scout: "haiku",
    spec: "fable",
    research: "sonnet",
    build: "sonnet",
    measure: "haiku",
    refute: "sonnet", // breadth lenses: correctness, acceptance, security, adversary
    invariants: "opus",
    critic: "opus",
    arbiter: "fable",
    fix: "opus",
    close: "sonnet",
  },
  opts.models || {},
);
const MAX_FIX_ROUNDS = Number(opts.maxFixRounds) >= 0 ? Number(opts.maxFixRounds) : 2;
const SKIP = new Set(Array.isArray(opts.skipLenses) ? opts.skipLenses : []);
// Token gates, only enforced when the session set a budget target (budget.total).
const MIN_BUDGET_PER_TASK = 150_000; // plan through close, one fix round, no research
const TAIL_BUDGET = 100_000; // build + measure + refute + fix + close; checked again right before build

const scratchDir = (id) => `${opts.scratch}/${id}`;
const STATUS = {
  todo: "[ ]",
  inProgress: "[IN PROGRESS]",
  finished: "[FINISHED - PENDING MERGE]",
  done: "[MERGED/DONE]",
  blocked: "[BLOCKED]",
};

// ---------- shared prefix: identical first block in every stage prompt so the prompt cache is shared ----------
const COMMON = `You are one stage of an unattended build loop. The repo root is the working directory.
- Commands (install, test, lint, format) come from the "## Commands" table in CLAUDE.md, which is already in your context; the planner copied them into the stage inputs below. Never invent a package manager, a test filter, or a script name that the table does not show.
- Doc system: SOURCE_OF_TRUTH.md (apex truth), ARCHITECTURE_ROADMAP.md, docs/architecture/NN-*.md (modular details), TODO_WORKFLOW.md (task rows: # | Task | Architecture Ref | Status | Branch), docs/handoff.md (newest-first log). Status strings, exact: "[ ]", "[IN PROGRESS]", "[FINISHED - PENDING MERGE]", "[MERGED/DONE]", "[BLOCKED] <reason>".
- Git: never commit to main, never force-push, never delete branches, never skip hooks. Commit as the repo owner only: no Co-Authored-By trailer, no AI mention in messages.
- Do not invoke skills, do not spawn subagents. Keep each shell command short.
- Scratch files for this task live under <scratch>/<taskId>/ (create the directory when you write there).
- Your final message is machine-read. Return only the structured object; no prose around it.`;

// ---------- schemas ----------
const STR_ARR = { type: "array", items: { type: "string" } };
const PLAN_SCHEMA = {
  type: "object",
  properties: {
    taskId: { type: ["string", "null"] },
    taskRow: { type: "string", description: "the full TODO table row, verbatim" },
    branch: { type: "string" },
    baseCommit: { type: "string", description: "git rev-parse HEAD before any edit (or the stored one when resuming)" },
    docsToRead: STR_ARR,
    leftForThisTask: STR_ARR,
    commands: {
      type: "object",
      properties: {
        install: { type: ["string", "null"] },
        test: { type: ["string", "null"] },
        lint: { type: ["string", "null"] },
        format: { type: ["string", "null"] },
        notes: { type: ["string", "null"] },
      },
      required: ["test"],
    },
    resuming: { type: "boolean" },
    stopReason: { type: ["string", "null"] },
    staleBlocked: {
      type: ["object", "null"],
      properties: { taskId: { type: "string" }, reason: { type: "string" }, branch: { type: ["string", "null"] } },
      required: ["taskId", "reason"],
    },
  },
  required: ["taskId", "stopReason", "staleBlocked", "resuming"],
};
const SCOUT_SCHEMA = {
  type: "object",
  properties: {
    files: {
      type: "array",
      items: {
        type: "object",
        properties: {
          path: { type: "string" },
          why: { type: "string" },
          symbols: STR_ARR,
          scope: { type: "string", enum: ["modify", "create", "reuse", "read"] },
        },
        required: ["path", "why"],
      },
    },
    tests: STR_ARR,
    docSections: {
      type: "array",
      items: {
        type: "object",
        properties: { path: { type: "string" }, heading: { type: "string" }, lines: { type: "string" } },
        required: ["path", "heading"],
      },
    },
    notes: { type: "array", items: { type: "string" }, maxItems: 8 },
  },
  required: ["files", "tests", "docSections"],
};
const SPEC_SCHEMA = {
  type: "object",
  properties: {
    specPath: { type: "string" },
    docsChanged: STR_ARR,
    unverifiedApis: STR_ARR,
    verifyCommands: { type: "array", items: { type: "string" }, description: "literal shell strings the builder must run" },
    stopReason: { type: ["string", "null"] },
  },
  required: ["specPath", "unverifiedApis", "verifyCommands", "stopReason"],
};
const RESEARCH_SCHEMA = {
  type: "object",
  properties: { researchPath: { type: "string" }, unverifiedRemaining: STR_ARR },
  required: ["researchPath", "unverifiedRemaining"],
};
const BUILD_SCHEMA = {
  type: "object",
  properties: {
    ok: { type: "boolean" },
    commits: STR_ARR,
    testsPassed: { type: "boolean" },
    lintPassed: { type: "boolean" },
    deviations: { type: "array", items: { type: "string" }, maxItems: 10 },
    blockedReason: { type: ["string", "null"] },
  },
  required: ["ok", "commits", "testsPassed", "lintPassed", "deviations", "blockedReason"],
};
const MEASURE_SCHEMA = {
  type: "object",
  properties: {
    filesChanged: { type: "integer" },
    linesChanged: { type: "integer" },
    docsOnly: { type: "boolean" },
    touchesTrustBoundary: { type: "boolean" },
    trustPaths: STR_ARR,
    languages: STR_ARR,
  },
  required: ["filesChanged", "linesChanged", "docsOnly", "touchesTrustBoundary"],
};
const FINDING = {
  type: "object",
  properties: {
    file: { type: "string" },
    line: { type: ["integer", "null"] },
    issue: { type: "string" },
    fix: { type: "string" },
  },
  required: ["file", "issue", "fix"],
};
const REFUTE_SCHEMA = {
  type: "object",
  properties: {
    verdict: { type: "string", enum: ["pass", "fail"] },
    testsRan: { type: "boolean" },
    blocking: { type: "array", items: FINDING, maxItems: 8 },
    advisory: { type: "array", items: FINDING, maxItems: 6 },
  },
  required: ["verdict", "testsRan", "blocking", "advisory"],
};
const ARBITER_SCHEMA = {
  type: "object",
  properties: {
    rulings: {
      type: "array",
      items: {
        type: "object",
        properties: {
          key: { type: "string" },
          ruling: { type: "string", enum: ["upheld", "dismissed"] },
          reason: { type: "string" },
        },
        required: ["key", "ruling", "reason"],
      },
    },
  },
  required: ["rulings"],
};
const FIX_SCHEMA = {
  type: "object",
  properties: {
    fixed: STR_ARR,
    notFixed: {
      type: "array",
      items: {
        type: "object",
        properties: { key: { type: "string" }, reason: { type: "string" } },
        required: ["key", "reason"],
      },
    },
    commits: STR_ARR,
  },
  required: ["fixed", "notFixed", "commits"],
};
const CLOSE_SCHEMA = {
  type: "object",
  properties: { ok: { type: "boolean" }, commit: { type: ["string", "null"] } },
  required: ["ok"],
};

// ---------- helpers ----------
// Read-only stages get one retry when the agent dies (a transient API error mid-response was observed
// to null a finished scout). Stages with side effects (plan, build, fix, close, adversary) never retry.
async function retryOnce(label, run) {
  const first = await run();
  if (first) return first;
  log(`${label} returned nothing; retrying once`);
  return run();
}
const findingKey = (f) => `${f.file}:${f.line == null ? "-" : f.line}`;
// One finding, not one location: two lenses can raise different problems at the same file:line.
const findingId = (f) => findingKey(f) + "|" + String(f.issue || "").slice(0, 40).toLowerCase();
const fmtFinding = (f, i) => `${i + 1}. [${findingKey(f)}] ${f.issue} -> ${f.fix}`;
const fmtCommands = (c) =>
  ["install", "test", "lint", "format"]
    .map((k) => `${k}: ${c && c[k] ? c[k] : "(none)"}`)
    .concat(c && c.notes ? [`notes: ${c.notes}`] : [])
    .join("; ");

// ---------- stages ----------
async function plan(done) {
  const forced = opts.task
    ? `The owner asked for task "${opts.task}" specifically: pick it if it is eligible or resumable, otherwise stop with the reason.`
    : "";
  return agent(
    `${COMMON}

Stage: plan. Pick the next TODO task and open its branch. Read only: TODO_WORKFLOW.md, "git status --short", "git branch --show-current", "git log --oneline -5", and (for resume checks) "${opts.scratch}/<id>/plan.json".
Already done this run: ${done.length ? done.join(", ") : "nothing"}.
${forced}

Preconditions, checked first; on failure set stopReason and pick nothing:
- TODO_WORKFLOW.md or SOURCE_OF_TRUTH.md missing -> stopReason "missing <file>: run the architect skill first".
- Working tree dirty -> stopReason "dirty tree: <git status --short, verbatim>".
- Commands: take the "## Commands" table from CLAUDE.md (root row, plus the package row that the task touches). If CLAUDE.md has no such section, fall back ONLY to a single unambiguous root manifest whose scripts name test/lint (package.json "scripts", pyproject/Makefile targets); if there is none, or more than one candidate, stopReason "no ## Commands table in CLAUDE.md and no single root manifest; add the table". Never guess a command.

Resume first: a row whose Status is "[IN PROGRESS]" is resumable only when ALL hold: its Branch exists locally; "${opts.scratch}/<id>/plan.json" exists and has baseCommit; "git merge-base --is-ancestor <baseCommit> HEAD" exits 0 after switching to that branch; the tree is clean. Then pick it with resuming=true and reuse the stored baseCommit. If a stale "[IN PROGRESS]" row fails any of those checks, do not pick it: return staleBlocked = {taskId, reason, branch (the row's branch if it exists, else null)} (the loop closes it as BLOCKED for a human) and taskId null.

Otherwise eligibility, in file order, first match wins:
1. Status is exactly "[ ]" and the Branch column names a branch (not "—" or empty).
2. Every earlier row in the same phase is FINISHED, DONE, or BLOCKED for a reason that does not affect this task's code.
3. No owner action is needed: no decision to ratify, no account, purchase, device, playtest, or GUI install. A task that needs a tool not on this machine (check "<tool> --version" only when the row names it) is ineligible.
4. A BLOCKED row that names a pending decision makes every task whose Architecture Ref depends on it ineligible until the docs record the decision.
5. Rows in a later phase are eligible only when no earlier phase has an eligible row.
If nothing is eligible, stopReason names the first two rows you rejected and why, one line.

When you pick a task:
- Record baseCommit = "git rev-parse HEAD" BEFORE any edit (when resuming, the stored one).
- If the row's branch exists, "git switch" to it; otherwise "git switch -c <branch>" from the current HEAD. Never main.
- Edit the row's Status to "[IN PROGRESS]" (skip when already so) and commit "docs: TODO <id> in progress".
- Write "${opts.scratch}/<id>/plan.json" with {taskId, baseCommit, branch} (create the directory).
- docsToRead: the row's Architecture Ref links plus the SOURCE_OF_TRUTH.md sections on invariants and on the domain the task touches.
- leftForThisTask: every "Left for <id>" sentence in other rows or docs/handoff.md that names this id.
- commands: {install, test, lint, format, notes} copied from the Commands table (null when the table has no such column for the scope).`,
    { label: "plan", phase: "Plan", model: M.plan, effort: "high", schema: PLAN_SCHEMA },
  );
}

async function scout(p) {
  return agent(
    `${COMMON}

Stage: scout. Read-only. Report locations, never file contents.
Task ${p.taskId}: ${p.taskRow}
Docs named by the task: ${p.docsToRead.join(", ") || "none"}
Carried-over notes: ${p.leftForThisTask.length ? p.leftForThisTask.join(" | ") : "none"}

Do: find every source file, symbol and existing test the task will touch or must reuse (grep and glob; read only excerpts); for each doc in the list, find the exact heading and line range that governs this task; note conventions the builder must copy (import style, test helpers, how existing tests are structured). Mark each file's scope: modify, create, reuse, or read.
Don't: read whole files, propose designs, edit anything.
Keep "why" under 15 words each; at most 25 files.`,
    { label: `scout:${p.taskId}`, phase: "Scout", model: M.scout, effort: "low", schema: SCOUT_SCHEMA },
  );
}

async function spec(p, s) {
  const dir = scratchDir(p.taskId);
  return agent(
    `${COMMON}

Stage: spec. Docs first, then a spec the builder can follow without judgment calls.
Task ${p.taskId}: ${p.taskRow}
Branch: ${p.branch} (already checked out). Base commit: ${p.baseCommit}. Resuming: ${p.resuming ? "yes, read the existing " + dir + "/spec.md and update it instead of starting over" : "no"}.
Carried-over notes: ${p.leftForThisTask.length ? p.leftForThisTask.join(" | ") : "none"}
Commands from CLAUDE.md: ${fmtCommands(p.commands)}
Scout report (locations only): ${JSON.stringify(s)}

Read: the SOURCE_OF_TRUTH.md sections relevant to the task, the doc sections the scout listed, and the relevant ranges of the source files it listed.

Architecture-change rule: if the task changes any architectural fact (a surface, a shape, a constant, a message, a storage layout), update SOURCE_OF_TRUTH.md, then ARCHITECTURE_ROADMAP.md, then the docs/architecture/NN-*.md file FIRST, and commit "docs(<area>): <what>" before writing the spec. Record the surface (signatures, file names, test names) in the doc so the code has something to match. If nothing architectural changes, change no docs.

Least code that satisfies the row: reuse existing helpers before writing new ones; no new dependencies unless a doc already names them; no scaffolding for later tasks; one file where one file will do.

Write ${dir}/spec.md with exactly these sections:
1. Goal (2 lines) 2. Files to create or modify (exact paths, one line each) 3. Surface (signatures, types, constants; copy from the docs) 4. Tests to write (file, test name, what it asserts) 5. Verification commands (literal shell strings, taken from the Commands table) 6. Do not (things the builder must not touch or invent) 7. Acceptance criteria (checkable statements, each traceable to the task row) 8. Unverified APIs (external library surfaces you did not confirm in this repo or its installed packages; empty list if none).
Keep spec.md under 120 lines. verifyCommands in your output = the section 5 strings.
If the task cannot be specified from the docs (a decision is missing), do not guess: keep any doc edit you already committed, discard uncommitted stray edits ("git checkout -- <file>" only for files you touched), set stopReason naming the missing decision.`,
    { label: `spec:${p.taskId}`, phase: "Spec", model: M.spec, effort: "high", schema: SPEC_SCHEMA },
  );
}

async function research(p, sp) {
  const dir = scratchDir(p.taskId);
  return agent(
    `${COMMON}

Stage: research. Verify library facts; never guess.
Task ${p.taskId}. Spec: ${sp.specPath}. APIs the spec could not verify: ${sp.unverifiedApis.join(" | ")}
Do: for each API, confirm the exact signature and behavior against the installed version (the package's manifest for the version, then its type definitions or source) or via the context7 MCP tools (load them with ToolSearch). Note the source of each fact.
Don't: edit any repo file, read the rest of the codebase.
Write ${dir}/research.md: one heading per API, then "Verified:" facts with their source, then "Unverified:" for anything you could not confirm. Under 80 lines.`,
    { label: `research:${p.taskId}`, phase: "Research", model: M.research, effort: "medium", schema: RESEARCH_SCHEMA },
  );
}

async function build(p, sp, hasResearch) {
  const dir = scratchDir(p.taskId);
  return agent(
    `${COMMON}

Stage: build. Implement the spec exactly; the spec is the contract.
Task ${p.taskId} on branch ${p.branch}. Read ${sp.specPath}${hasResearch ? ` and ${dir}/research.md` : ""} first, then only the files the spec names (plus anything they import that you must understand).
Verification commands (run these, literally): ${sp.verifyCommands.length ? sp.verifyCommands.join(" && ") : fmtCommands(p.commands)}

Do:
- Implement every item in "Files to create or modify" and "Tests to write".
- Run the verification commands; test and lint must exit 0 before you finish. Run the format command if lint complains about formatting.
- Commit per logical step (Conventional Commits: feat/fix/refactor/test/chore/docs, subject under 72 chars). Several small commits beat one big one.
- If you must deviate from the spec (an assumption in it is wrong), do the smallest correct thing and list it under deviations.
Don't:
- Touch SOURCE_OF_TRUTH.md, ARCHITECTURE_ROADMAP.md, docs/architecture, docs/handoff.md, or TODO_WORKFLOW.md. The status update belongs to a later stage; a TODO edit by the builder is a defect.
- Report testsPassed or lintPassed as true unless the command exited 0; a lint failure in a file you did not touch still fails lint (fix it if small, otherwise report it).
- Add dependencies, abstractions, or files the spec does not name. Mark nothing done that the tests do not prove.
If you cannot proceed (missing tool, a spec contradiction you cannot resolve with a small deviation), stop, leave the tree committed or clean, and set blockedReason.
Write ${dir}/build.md: commits made, test and lint results (last lines only), deviations, doubts. Under 60 lines.`,
    { label: `build:${p.taskId}`, phase: "Build", model: M.build, schema: BUILD_SCHEMA },
  );
}

async function measure(p) {
  return agent(
    `${COMMON}

Stage: measure. Read-only, mechanical. Run "git diff --stat ${p.baseCommit}..HEAD" and "git diff --name-only ${p.baseCommit}..HEAD" and report:
- filesChanged, linesChanged (insertions + deletions from --stat's summary line; 0 if empty).
- docsOnly: true when every changed path is markdown or under docs/.
- touchesTrustBoundary: true when any changed path or its directory name contains auth, session, token, secret, payment, billing, upload, permission, or handler (case-insensitive); list them under trustPaths.
- languages: file extensions seen, e.g. ["ts","py"].
Do not read file contents beyond the two commands.`,
    { label: `measure:${p.taskId}`, phase: "Measure", model: M.measure, effort: "low", schema: MEASURE_SCHEMA },
  );
}

// Lens text. Breadth lenses run on M.refute; invariants and critic run on their own models.
const LENSES = {
  correctness: {
    model: () => M.refute,
    text: (p, sp) => `Lens: correctness and tests. Rerun the verification commands yourself: ${sp.verifyCommands.length ? sp.verifyCommands.join(" && ") : fmtCommands(p.commands)}. A "done" claim is not evidence. Then read the diff for logic errors, off-by-one and boundary cases, unhandled failure paths, tests that cannot fail, and spec items with no test. If tests or lint exit non-zero, or you could not run them, verdict is fail and the failing command is a blocking finding. A TODO_WORKFLOW.md or docs/handoff.md edit in a commit other than the planner's "in progress" one is blocking (the builder must not touch them).`,
  },
  acceptance: {
    model: () => M.refute,
    text: (p, sp) => `Lens: acceptance. Take section 7 (Acceptance criteria) of ${sp.specPath} and check each criterion against the diff and the tests, one by one: is it implemented, and is there a test that would fail if it were not? An unmet or untested criterion is a blocking finding citing the file that should satisfy it. Also compare section 2 (files) with "git diff --name-only ${p.baseCommit}..HEAD": files changed that the spec did not name are advisory unless they change behavior. Do not run the tests; the correctness lens does.`,
  },
  invariants: {
    model: () => M.invariants,
    text: (p, sp) => `Lens: architecture and invariants. Read the invariants section of SOURCE_OF_TRUTH.md (whatever it lists; there may be none) and the docs the task cites (${p.docsToRead.join(", ") || "none"}). Check the diff against every invariant that applies and where the docs say it is enforced; check the docs-first rule (does the doc describe every surface that shipped, and does the code match the documented surface?); check the spec's "Do not" section; check for dependencies, abstractions or files that the spec did not ask for. Do not run the tests.`,
  },
  security: {
    model: () => M.refute,
    text: (p, sp, m) => `Lens: security at the trust boundary. The diff touches ${m.trustPaths && m.trustPaths.length ? m.trustPaths.join(", ") : "paths that look security-relevant"}. Check: input validation at the boundary, authz/authn on every new or changed handler, injection (SQL, shell, template, path), secrets in code or logs, error messages that leak internals, insecure defaults. Cite file and line for each. Do not run the tests.`,
  },
  adversary: {
    model: () => M.refute,
    text: (p, sp) => `Lens: adversarial test. Write ONE test that you believe the implementation fails: an edge case, a failure path, or an acceptance criterion from ${sp.specPath} section 7 that the existing tests do not pin. Put it in the test location the spec names, run only that test with the repo's test command. If it FAILS, leave the test file uncommitted in the tree and report the failure as a blocking finding citing the test file (the fixer will adopt it). If it PASSES, delete the test file (leave the tree exactly as you found it) and report verdict pass with what you tried under advisory. Never commit.`,
  },
  critic: {
    model: () => M.critic,
    text: (p, sp) => `Lens: completeness critic. Compare ${sp.specPath} against the task row itself: "${p.taskRow}" and the carried-over notes: ${p.leftForThisTask.length ? p.leftForThisTask.join(" | ") : "none"}. What did the spec leave out that the row asks for? What did it add that the row does not? An omission that the row plainly requires is a blocking finding citing the spec file and the section that should carry it; scope creep and ambiguity are advisory. Scope: the spec versus the row. Existing docs/handoff.md entries and "Left for" notes describe earlier attempts that the planner already consumed into this run; the scout's report lives only in memory (no file); the TODO row's status cell is the close stage's job. None of those is a finding. Do not run the tests.`,
  },
};

async function refute(p, sp, m, lens, round) {
  return agent(
    `${COMMON}

Stage: refute. Your job is to REFUTE the builder's claim that task ${p.taskId} is done. Edit nothing and commit nothing, except where the lens text below says otherwise.
Spec: ${sp.specPath}. Builder report: ${scratchDir(p.taskId)}/build.md. Diff: "git diff ${p.baseCommit}..HEAD". That range also contains the planner's "docs: TODO ${p.taskId} in progress" commit (the TODO_WORKFLOW.md status cell) and any "docs(...)" commits from the spec stage; both are expected, not findings, and the spec's file list never mentions them. Review the spec-stage doc commits for consistency with the code. A TODO_WORKFLOW.md or docs/handoff.md change in any other commit is blocking. Round ${round}.
${LENSES[lens].text(p, sp, m)}
Blocking = wrong to merge (bug, failing or missing test for a spec item, invariant broken, docs and code disagree). Advisory = worth carrying to the TODO row's "Left for" note, not worth a fix round. One line per finding with file and line. A fail verdict without a cited finding counts only as a vote; cite what you can. Default to fail when uncertain.`,
    {
      label: `refute:${lens}:${p.taskId}:r${round}`,
      phase: "Refute",
      model: LENSES[lens].model(),
      effort: lens === "invariants" || lens === "critic" ? "high" : "medium",
      schema: REFUTE_SCHEMA,
    },
  );
}

function lensesFor(round, m, carried) {
  const core = ["correctness", "acceptance", "invariants"];
  // Later rounds re-run the core plus any lens that blocked last round, so its finding can come back
  // (and reach the arbiter if disputed) instead of vanishing. The adversary is not re-run: its test is in the tree.
  if (round >= 2) return core.concat(carried.filter((l) => LENSES[l] && !core.includes(l) && l !== "adversary")).filter((l) => !SKIP.has(l));
  const extra = [];
  if (m.touchesTrustBoundary) extra.push("security");
  if (!m.docsOnly && m.linesChanged >= 30) extra.push("adversary");
  extra.push("critic");
  return core.concat(extra).filter((l) => !SKIP.has(l));
}

// Evidence-weighted merge: a cited finding always blocks; uncited fail verdicts block only when >= 2 lenses agree.
function merge(votes) {
  const blocking = [];
  const seen = new Set();
  for (const v of votes) {
    for (const f of v.blocking) {
      if (!f.file || f.file === "unknown") continue;
      const k = findingId(f);
      if (seen.has(k)) continue;
      seen.add(k);
      blocking.push({ ...f, lens: v.lens });
    }
  }
  const uncitedFails = votes.filter((v) => v.verdict === "fail" && !v.blocking.some((f) => f.file && f.file !== "unknown"));
  if (!blocking.length && uncitedFails.length >= 2) {
    blocking.push({
      file: "unknown",
      line: null,
      issue: `${uncitedFails.length} lenses (${uncitedFails.map((v) => v.lens).join(", ")}) failed the build without a cited finding; rerun the verification commands and read the diff`,
      fix: "make the verification commands pass and address what the diff shows",
      lens: "vote",
    });
  }
  const advisory = votes.flatMap((v) => v.advisory.map((f) => ({ ...f, lens: v.lens })));
  return { blocking, advisory, uncitedFails: uncitedFails.map((v) => v.lens) };
}

async function arbiter(p, disputed) {
  return agent(
    `${COMMON}

Stage: arbiter. Read-only. A reviewer raised each finding below, the fixer disputed it instead of fixing it, and the reviewer raised it again. Rule on each: "upheld" (the finding is real and must be fixed) or "dismissed" (the fixer is right; the finding is wrong or already handled). Read the diff "git diff ${p.baseCommit}..HEAD" and the cited lines yourself; do not take either side's word.
${disputed.map((d, i) => `${i + 1}. key ${findingKey(d.finding)} | finding: ${d.finding.issue} -> ${d.finding.fix} | fixer's dispute: ${d.reason}`).join("\n")}
Return one ruling per key, with a one-line reason.`,
    { label: `arbiter:${p.taskId}`, phase: "Arbiter", model: M.arbiter, effort: "high", schema: ARBITER_SCHEMA },
  );
}

async function fix(p, sp, blocking, round) {
  return agent(
    `${COMMON}

Stage: fix. Address every blocking review finding for task ${p.taskId}, nothing else.
Spec: ${sp.specPath}. Branch ${p.branch}. Round ${round}.
Verification commands: ${sp.verifyCommands.length ? sp.verifyCommands.join(" && ") : fmtCommands(p.commands)}
Findings (the key in brackets is file:line; use it in fixed/notFixed):
${blocking.map(fmtFinding).join("\n")}

Do: fix each finding with the smallest correct change; add or repair the test that proves it. If an uncommitted test file is sitting in the tree (left by the adversarial lens), adopt it: make it pass and commit it with the fix. Run the verification commands; commit "fix(<area>): <what>" (or test:/docs: as fits). If a finding is wrong, say so under notFixed with its key and a one-line reason instead of changing code.
Don't: refactor, widen scope, touch TODO_WORKFLOW.md or docs/handoff.md.`,
    { label: `fix:${p.taskId}:r${round}`, phase: "Fix", model: M.fix, effort: "high", schema: FIX_SCHEMA },
  );
}

async function close(p, sp, outcome) {
  const dir = scratchDir(p.taskId);
  const statusCell = outcome.status === STATUS.blocked ? `${STATUS.blocked} ${outcome.reason}` : outcome.status;
  const subject =
    outcome.status === STATUS.finished ? "finished, pending merge" : outcome.status === STATUS.blocked ? "blocked" : "not started";
  return agent(
    `${COMMON}

Stage: close. Record the outcome of task ${p.taskId} where the next session will look. You are the only stage that edits TODO_WORKFLOW.md and docs/handoff.md.
Branch ${p.branch}. If you are not on it and it exists, switch to it first. If you are on main and it does not exist, do not commit: return ok false. Outcome: ${JSON.stringify(outcome)}
Read ${dir}/build.md and ${sp ? sp.specPath : dir + "/spec.md"} (sections 1 and 8 only) if they exist; if not, work from the outcome alone.

1. TODO_WORKFLOW.md, row ${p.taskId}: set Status to "${statusCell}" followed by a note in the same register as the finished rows above it: which docs changed (if any), the one-line result, then "Left for <next task id or 'later'>: ..." carrying every advisory finding, deviation and disputed finding worth keeping. Under 90 words. Do not touch other rows. ${outcome.status === STATUS.todo ? 'The status goes back to "[ ]" because nothing was built; the note says why the loop stopped.' : ""}
2. docs/handoff.md: create it if missing with a two-line header saying it is the build loop's log, newest first. Insert one entry at the top: "## <date from git log -1 --format=%cs> — ${p.taskId} ${outcome.status} (${p.branch})" then 3-6 bullets: what shipped, refute rounds and what they caught, what stays open. Do not recommend which row to pick next; the planner decides from TODO_WORKFLOW.md.
3. Commit both files: "docs: TODO ${p.taskId} ${subject}". If an uncommitted test file left by the adversarial review lens is still in the tree (it was never adopted by a fix), delete it; the note in step 1 records what it tested. Leave "git status" empty.`,
    { label: `close:${p.taskId}`, phase: "Close", model: M.close, effort: "low", schema: CLOSE_SCHEMA },
  );
}

// Called on EVERY exit after plan succeeded, so no row is left "[IN PROGRESS]" with no handoff entry.
async function closeIfPossible(p, sp, outcome, results) {
  const c = await close(p, sp, outcome);
  if (!c || !c.ok) log(`close failed on ${p.taskId}; the row stays [IN PROGRESS] and the planner will offer to resume it next run`);
  results.push({
    taskId: p.taskId,
    branch: p.branch,
    status: outcome.status,
    reason: outcome.reason || null,
    fixRounds: outcome.rounds || 0,
    closed: Boolean(c && c.ok),
  });
  return c;
}

// ---------- the loop ----------
if (opts.dryRun) {
  log(`dry run: no agents launched; models ${JSON.stringify(M)}; maxFixRounds ${MAX_FIX_ROUNDS}; scratch ${opts.scratch}`);
  return { tasks: [], stoppedBecause: "dry run", next: "Run without dryRun to build.", models: M };
}

const results = [];
let stoppedBecause = null;
for (let n = 0; n < opts.maxTasks; n++) {
  if (budget.total && budget.remaining() < MIN_BUDGET_PER_TASK) {
    stoppedBecause = `budget: ${Math.round(budget.remaining() / 1000)}k left, under the ${MIN_BUDGET_PER_TASK / 1000}k a task needs`;
    break;
  }

  const p = await plan(results.map((r) => r.taskId));
  if (!p) {
    stoppedBecause = "planner returned nothing";
    break;
  }
  if (p.staleBlocked) {
    // A crashed earlier run left a row the planner cannot safely resume; hand it to a human instead of skipping it forever.
    const stale = { taskId: p.staleBlocked.taskId, branch: p.staleBlocked.branch || p.branch || "(unknown)", resuming: false };
    const c = await closeIfPossible(stale, null, { status: STATUS.blocked, reason: `stale in-progress row: ${p.staleBlocked.reason}`, rounds: 0, advisory: [] }, results);
    stoppedBecause =
      c && c.ok
        ? `stale [IN PROGRESS] row ${p.staleBlocked.taskId} closed as BLOCKED: ${p.staleBlocked.reason}`
        : `stale [IN PROGRESS] row ${p.staleBlocked.taskId} could not be closed; mark it by hand: ${p.staleBlocked.reason}`;
    break;
  }
  if (!p.taskId) {
    stoppedBecause = p.stopReason || "no eligible task";
    break;
  }
  // The schema cannot require these only when a task was picked, so check them here.
  p.docsToRead = p.docsToRead || [];
  p.leftForThisTask = p.leftForThisTask || [];
  if (!p.branch || !p.baseCommit) {
    const reason = `planner picked ${p.taskId} without ${!p.branch ? "a branch" : "a base commit"}`;
    await closeIfPossible({ ...p, branch: p.branch || "(unknown)" }, null, { status: STATUS.todo, reason, rounds: 0, advisory: [] }, results);
    stoppedBecause = reason;
    break;
  }
  log(`task ${p.taskId} on ${p.branch} (base ${String(p.baseCommit).slice(0, 7)})${p.resuming ? ", resuming" : ""}`);

  const s = await retryOnce("scout", () => scout(p));
  if (!s) {
    await closeIfPossible(p, null, { status: STATUS.todo, reason: "scout stage returned nothing", rounds: 0, advisory: [] }, results);
    stoppedBecause = `scout failed on ${p.taskId}`;
    break;
  }

  const sp = await spec(p, s);
  if (!sp || sp.stopReason) {
    const reason = sp ? sp.stopReason : "spec stage returned nothing";
    await closeIfPossible(p, sp, { status: STATUS.todo, reason, rounds: 0, advisory: [] }, results);
    stoppedBecause = `spec stopped on ${p.taskId}: ${reason}`;
    break;
  }
  log(`spec at ${sp.specPath}; docs changed: ${sp.docsChanged ? sp.docsChanged.length : 0}; unverified APIs: ${sp.unverifiedApis.length}`);

  let hasResearch = false;
  if (sp.unverifiedApis.length) {
    const r = await retryOnce("research", () => research(p, sp));
    hasResearch = Boolean(r);
    if (r && r.unverifiedRemaining.length) log(`still unverified after research: ${r.unverifiedRemaining.join(", ")}`);
  } else {
    log("research skipped: nothing unverified");
  }

  if (budget.total && budget.remaining() < TAIL_BUDGET) {
    const reason = `budget: ${Math.round(budget.remaining() / 1000)}k left before build, under the ${TAIL_BUDGET / 1000}k the build-refute-fix-close tail needs`;
    await closeIfPossible(p, sp, { status: STATUS.todo, reason, rounds: 0, advisory: [] }, results);
    stoppedBecause = reason;
    break;
  }

  const b = await build(p, sp, hasResearch);
  if (!b || !b.ok) {
    const reason = b ? b.blockedReason || "builder reported not ok" : "build stage returned nothing";
    await closeIfPossible(p, sp, { status: STATUS.blocked, reason, rounds: 0, advisory: [] }, results);
    stoppedBecause = `build blocked on ${p.taskId}: ${reason}`;
    break;
  }
  log(`built ${p.taskId}: ${b.commits.length} commits, tests ${b.testsPassed ? "pass" : "FAIL"}, lint ${b.lintPassed ? "pass" : "FAIL"}`);

  const m = (await retryOnce("measure", () => measure(p))) || { filesChanged: 0, linesChanged: 0, docsOnly: false, touchesTrustBoundary: true, trustPaths: [] };
  log(`diff: ${m.filesChanged} files, ${m.linesChanged} lines${m.docsOnly ? ", docs only" : ""}${m.touchesTrustBoundary ? ", trust boundary" : ""}`);

  let round = 1;
  let blocking = [];
  const advisory = [];
  const disputes = new Map(); // finding key -> fixer's reason, from the previous round
  const dismissed = new Set();
  let carriedLenses = [];
  let passed = false;
  let failedReason = null;
  while (round <= MAX_FIX_ROUNDS + 1) {
    const lenses = lensesFor(round, m, carriedLenses);
    // The adversary writes (and maybe deletes) a test file, so it runs after the others rather than
    // alongside lenses that run the whole suite on the same tree.
    const readers = lenses.filter((l) => l !== "adversary");
    const votes = (
      await parallel(readers.map((lens) => () => retryOnce(`refute:${lens}`, () => refute(p, sp, m, lens, round)).then((v) => (v ? { ...v, lens } : null))))
    ).filter(Boolean);
    if (lenses.includes("adversary")) {
      const v = await refute(p, sp, m, "adversary", round);
      if (v) votes.push({ ...v, lens: "adversary" });
    }
    if (!votes.length) {
      failedReason = `refute stage returned nothing in round ${round}`;
      break;
    }
    if (votes.length < lenses.length) log(`round ${round}: ${lenses.length - votes.length} of ${lenses.length} lenses returned nothing`);
    const merged = merge(votes);
    advisory.push(...merged.advisory);
    blocking = merged.blocking.filter((f) => !dismissed.has(findingId(f)));
    if (merged.uncitedFails.length === 1) log(`round ${round}: ${merged.uncitedFails[0]} failed without a citation; one vote does not block`);

    // A finding the fixer disputed last round that came back goes to the arbiter once.
    const reappeared = blocking.filter((f) => disputes.has(findingKey(f)));
    if (reappeared.length) {
      const a = await arbiter(p, reappeared.map((f) => ({ finding: f, reason: disputes.get(findingKey(f)) })));
      for (const r of a ? a.rulings : []) {
        if (r.ruling === "dismissed") {
          for (const f of reappeared) if (findingKey(f) === r.key) dismissed.add(findingId(f));
          advisory.push({ file: r.key.split(":")[0], line: null, issue: `arbiter dismissed: ${r.reason}`, fix: "none", lens: "arbiter" });
        }
      }
      blocking = blocking.filter((f) => !dismissed.has(findingId(f)));
      log(`arbiter ruled on ${reappeared.length}: ${a ? a.rulings.filter((r) => r.ruling === "dismissed").length : 0} dismissed`);
    }

    if (!blocking.length) {
      passed = true;
      break;
    }
    carriedLenses = [...new Set(blocking.map((f) => f.lens))];
    log(`refute round ${round} on ${p.taskId}: ${blocking.length} blocking, ${advisory.length} advisory`);
    if (round > MAX_FIX_ROUNDS) break;
    const f = await fix(p, sp, blocking, round);
    disputes.clear();
    if (f) for (const d of f.notFixed) disputes.set(d.key, d.reason);
    if (f && f.notFixed.length) log(`fixer disputed ${f.notFixed.length}: ${f.notFixed.map((d) => d.key).join(", ")}`);
    if (!f) log(`fix stage returned nothing in round ${round}; re-refuting the tree as it is`);
    round++;
  }

  const rounds = Math.max(0, round - 1);
  if (failedReason) {
    await closeIfPossible(p, sp, { status: STATUS.blocked, reason: failedReason, rounds, advisory: advisory.slice(0, 8) }, results);
    stoppedBecause = `${failedReason} on ${p.taskId}`;
    break;
  }
  const outcome = passed
    ? { status: STATUS.finished, rounds, advisory: advisory.slice(0, 8), disputed: [...disputes.entries()].map(([k, v]) => `${k}: ${v}`) }
    : {
        status: STATUS.blocked,
        reason: `still failing review after ${MAX_FIX_ROUNDS} fix rounds`,
        rounds,
        advisory: advisory.slice(0, 8),
        remainingBlocking: blocking.map((f) => `${findingKey(f)} ${f.issue}`),
      };
  await closeIfPossible(p, sp, outcome, results);
  if (!passed) {
    stoppedBecause = `refute still failing after ${MAX_FIX_ROUNDS} fix rounds on ${p.taskId}`;
    break;
  }
  log(`closed ${p.taskId} after ${rounds} fix round(s)`);
}
if (!stoppedBecause) stoppedBecause = `reached maxTasks=${opts.maxTasks}`;
log(`stopped: ${stoppedBecause}`);
return {
  tasks: results,
  stoppedBecause,
  next: "Run again from a fresh session; state is in TODO_WORKFLOW.md and docs/handoff.md.",
};
