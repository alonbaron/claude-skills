# Step 5 prerequisites: the three checks on Linux (2026-09-23)

Machine: Linux cloud container, root, Claude Code 2.1.280. Supersedes the Linux
assumptions in STEP4.md and evals/README.md.

## 1. Auth and sandbox

- Auth works. `claude -p` and `claude plugin eval` both ran and billed.
- No sandbox backend at first: `--allow-tools Bash` refused the run ("bubblewrap
  (bwrap) not installed, socat not installed"). After `apt-get install bubblewrap
  socat` the runner accepts the grant, but every shell call inside the run fails:
  `apply-seccomp: write /proc/self/uid_map: Operation not permitted`. Plain nested
  bwrap works from the host shell; the failure is in the runner's seccomp helper
  inside this container. The runner writes its own settings.json per run, so
  `sandbox.enableWeakerNestedSandbox` cannot be set from here.

## 2. Scaffolds

- They execute. dirty-and-behind, `--scaffold --keep-temp`: the workspace was a
  real clone, behind origin by 2, `src/api_client.py` dirty, reflog showing the
  `reset --hard HEAD~2`.
- New blocker: `!` injections. Without a Bash grant the Skill call errors with
  "Shell command permission check failed ... Permission to use Bash has been
  denied" and the skill body never loads (probe with haiku, explicit invocation).
  With Bash granted the injection runs into the seccomp failure above. So
  architect, review-swarm and up-to-date (the three skills with `!` lines) cannot
  load in an eval on this machine, whether or not the case has a scaffold.
- Runs: check2 with Bash (score 0.67, $0.54), check2b without Bash (score 0,
  skill never invoked, model spawned an Agent instead), probe4 (injection denied).

## 3. avoids-padded-interfaces

- The grader was at fault, not the model's summary. In 2.1.280, `target: files`
  is `cwdDiff`, which the runner builds as the sorted list of paths the run
  created, not their contents. `file_exists` globs the same list.
- Probes (haiku, `probe-regex/`, not committed): a literal marker in a
  scaffold-written file and in an agent-written file were both "not found in
  files"; the `not_contains` form passed in all three. A `tool_used: Write` grader
  with `input_match` on the class pattern counted the Write (min 1 passed, max 0
  failed). JS regex, so `(?i)` is rejected.
- Fix: avoids-padded-interfaces is now `tool_used: Write`, `input_match` on the
  same pattern, `max: 0`, `arm: both`. README corrected.
