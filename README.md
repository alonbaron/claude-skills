<p align="center">
  <img src="./assets/hero.svg" alt="alon-skills — six Claude Code skills, one install" width="900">
</p>

<p align="center">
  <img alt="Claude Code plugin" src="https://img.shields.io/badge/Claude_Code-plugin-0891B2?style=flat-square&labelColor=0F1E33">&nbsp;
  <img alt="6 skills" src="https://img.shields.io/badge/skills-6-4F46E5?style=flat-square&labelColor=0F1E33">&nbsp;
  <img alt="version" src="https://img.shields.io/badge/version-v2.1.0-7C3AED?style=flat-square&labelColor=0F1E33">&nbsp;
  <img alt="MIT license" src="https://img.shields.io/badge/license-MIT-059669?style=flat-square&labelColor=0F1E33">&nbsp;
  <a href="https://github.com/alonbaron"><img alt="by alonbaron" src="https://img.shields.io/badge/by-alonbaron-C026D3?style=flat-square&labelColor=0F1E33&logo=github&logoColor=white"></a>
</p>

<p align="center">
  <b>Six Claude Code skills tuned to one engineering style: model-first, failure-path-aware, YAGNI.</b><br>
  <sub>One install. Usable in the Claude Code CLI and the VS Code / JetBrains extensions.</sub>
</p>

---

## ◢ Install

```text
/plugin marketplace add alonbaron/claude-skills
/plugin install alon-skills@alonbaron
```

Pull updates anytime with `/plugin marketplace update alonbaron` — the marketplace tracks `main`, so you're always on the latest. Tagged releases like [`v2.1.0`](https://github.com/alonbaron/claude-skills/releases) mark the milestones.

---

## ◢ The skills

| Skill | Invoke | What it does |
|---|---|---|
| **architect** | `/architect` | Production-grade design docs *before* code — domain model + invariants → failure-path design → API contracts → a sequenced workstream. |
| **review-swarm** | `/review-swarm` | Parallel specialist reviewers (correctness, security, perf, altitude, simplicity, tests) → adversarial verification → a ranked, `file:line` report. |
| **ask-the-council** | `/ask-the-council` | A panel of advisors forced to disagree, then a Chairman who **commits** to one recommendation with the tradeoff named. |
| **prompt-generator** | `/prompt-generator` | Vague ask → rigorous prompt. Anti-hallucination, anti-tokenmaxing, strict agent rules baked in. |
| **up-to-date** | `/up-to-date` | Preflight repo sync + situational brief before you start. Read-only by default — never touches a dirty tree without your OK. |
| **ponytail** | `/ponytail` | Lazy-senior-dev mode: the simplest thing that actually works. *(MIT, vendored — see License.)* |

Each skill also triggers from plain language — e.g. *"spec this out before we build"*, *"swarm review this diff"*, *"ask the council whether…"*, *"catch me up on the repo"*, *"be lazy here"*.

**v2 — proactive by default.** Since v2.0.0 the skills fire on task *shape*, not just keywords: starting a new feature invokes **architect**, opening work in a repo with a remote invokes **up-to-date**, finishing a non-trivial implementation invokes **review-swarm**, a solution growing past the minimum invokes **ponytail** — announced in one line, no permission asked. Each skill carries a "when not to use" boundary so it stays out of the way on trivial work.

---

## ◢ Living with Claude Code's built-ins

A skill that fires when a built-in should have, or stays quiet because a built-in got there first, is a bug even when both are good on their own. v2.1 settles the overlaps inside the descriptions, so the choice gets made at trigger time instead of after you already have the wrong answer.

| Overlap | Who wins | Why |
|---|---|---|
| **ponytail** vs `/simplify` | split | ponytail governs what gets *built*, before and while you write it. `/simplify` cleans a diff that already exists. |
| **review-swarm** vs `/code-review` | review-swarm | It's the default for a real diff. `/code-review` takes over when you name it, or for a one-liner not worth a swarm. |
| **review-swarm** vs `/security-review` | depends on the ask | Security is one of the swarm's six lenses. When security is the whole question, `/security-review` goes deeper. |

If you also run a UX skill or a prose skill, two hand-offs are worth wiring: review-swarm passes UI and accessibility hunks to the design reviewer instead of guessing at them, and architect's executive summaries are prose worth humanizing. Its tables, invariants, and API contracts are not.

---

## ◢ Companion skills

Not shipped here and not mine. Two third-party skills the hand-offs above are written against, if you want somewhere for them to go. Install them separately.

| Skill | Source | Pairs with |
|---|---|---|
| **ux-designer** | [szilu/ux-designer-skill](https://github.com/szilu/ux-designer-skill) (MIT) | review-swarm, which passes UI and accessibility hunks to it |
| **humanizer** | [blader/humanizer](https://github.com/blader/humanizer) (MIT) | architect, for executive summaries and README prose |

One catch worth knowing about humanizer: as of v2.9.1 the plugin puts `SKILL.md` at its root instead of `skills/humanizer/SKILL.md`. Claude Code installs it, reports it enabled, and never loads it. Copy `SKILL.md` out of `~/.claude/plugins/cache/humanizer/humanizer/<version>/` into `~/.claude/skills/humanizer/` and it works.

---

## ◢ What's new in v2.1

- Descriptions name the situation rather than the capability — when the skill should fire, the words you'd actually type, and when it should stay quiet.
- review-swarm stops at roughly 40 files or 2,000 changed lines, splits by area, and says which slice it read. A swarm that runs out of context mid-review still writes a confident report.
- `architect audit` findings cite both sides: the `file:line` in code that states the fact, and the doc that should describe it and doesn't. Anything less is a hunch.
- ask-the-council weighs the cost of being wrong before seating a panel. Four to six subagents is too much for a decision you can reverse in an afternoon.
- up-to-date handles a branch with no upstream. The divergence check fails on a fresh local branch or a detached HEAD, and it now says so instead of reporting "in sync" from a command that never ran.
- prompt-generator adds a ground-truth section: the paths, versions, and commands you verified, stated as facts the agent must check rather than invent.

---

## ◢ What they share

- **Lead with the answer.** Output budgets, no filler, no restating the question.
- **Verify or say "I don't know".** No invented files, APIs, or facts.
- **Read before you edit.** Small, reversible changes over rewrites.
- **Design the failure paths** as deliberately as the happy ones; enforce rules at the core.
- **Question whether the code needs to exist at all** before writing it.

---

## ◢ Manage

```text
/plugin list                            # what's installed
/plugin disable alon-skills@alonbaron   # turn off without uninstalling
/plugin uninstall alon-skills@alonbaron
```

---

## ◢ License

MIT — see [LICENSE](LICENSE). The **ponytail** skill is vendored from the third-party [DietrichGebert/ponytail](https://github.com/DietrichGebert/ponytail) (MIT, © Dietrich Gebert) and redistributed under the same terms; third-party attribution is recorded in [NOTICE](NOTICE).

<p align="center">
  <sub>Built by <a href="https://github.com/alonbaron">@alonbaron</a> · <b>Build the model. Define the rules. Then write the code.</b></sub>
</p>
