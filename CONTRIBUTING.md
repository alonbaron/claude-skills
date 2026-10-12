# Contributing

Every skill here is measured with and without the plugin, so a new skill, or a change to when one fires, comes with an eval case that shows the difference. No case, no merge.

## Add a skill

1. Create `skills/<name>/SKILL.md`. Frontmatter: `name`, `description` (what it does) and `when_to_use` (when it fires and when it stays quiet). Keep both short: the skill listing truncates long ones.
2. Write judgment rules with the reason attached, not numbered procedures.
3. Name the boundary. Say when the skill must stay quiet, and settle any overlap with a built-in inside the description (see [Living with Claude Code's built-ins](README.md#-living-with-claude-codes-built-ins)).
4. Update the README's skills table and trigger map, the skill count in the badge and banner, and the `Skill` dropdown in `.github/ISSUE_TEMPLATE/skill-misfire.yml`.

## Add its eval case

Every skill has at least three cases under `evals/<skill>/`, and at least one of them is a case where the skill must not fire. Copy a neighbouring case and edit it.

```text
evals/<skill>/<case>/
  prompt.md      frontmatter (name, description, tags, max_turns, timeout_seconds), then the user's message
  graders/*.md   one property per grader
  case.yaml      only when the case needs a fixture
  fixture.sh     builds a real git repo in the workspace
```

- Tag the case `portable` (runs anywhere) or `needs-scaffold` (has a fixture, so Linux/macOS only).
- Include a `tool_used: Skill` grader with `input_match` on the skill name. For a must-not-fire case, set `max: 0` and `arm: both`.
- Give each grader one property, with its own PASS and FAIL sentence. [`evals/README.md`](evals/README.md#writing-a-case) lists the traps (`target: files` holds paths, not contents; `input_match` runs on JSON-encoded input).

## Run one case

From the repo root:

```text
claude plugin eval . --case <case-name> --runs 2 --allow-tools Write Edit \
  --model claude-fable-5-1 --judge-model sonnet --no-publish --trust-plugin --threshold 0.7
```

For a `needs-scaffold` case, or any case for architect, review-swarm or up-to-date (they run shell commands when they load), add `--scaffold` and grant `Bash` too (`--allow-tools Write Edit Bash`). That needs a host where `bwrap` sandboxing works, such as a plain Linux VM or a CI runner; [`evals/README.md`](evals/README.md) has the details. At `--runs 2` on Fable 5.1, the 2026-10-04 runs averaged about $2.50 per in-container case and $5.30 per sandboxed one (API-equivalent). Results land in `evals/results/<timestamp>/`, which is gitignored.

The CI job runs on the maintainer's Claude plan, so a fork's PR does not trigger it. Paste your local numbers into the PR instead.

## PR checklist

- [ ] One change per PR, in small commits with a conventional prefix (`fix:`, `feat:`, `docs:`, `chore:`).
- [ ] A new or changed skill comes with an eval case; the PR shows both arms' scores.
- [ ] The skill's must-not-fire cases still pass.
- [ ] The README matches the change (skills table, trigger map, eval table, counts).
- [ ] Every number carries its date, model and Claude Code version.
- [ ] Nothing from `.claude/scratch/` is committed.
- [ ] Vendored third-party code keeps its license and has a line in [NOTICE](NOTICE).
