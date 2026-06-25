# alon-skills

A bundle of six [Claude Code](https://code.claude.com) skills tuned to a
**model-first, failure-path-aware, YAGNI** engineering style. Install once, get
all six — usable in the Claude Code CLI and the VS Code / JetBrains extensions.

## What's inside

| Skill | What it does |
| --- | --- |
| **prompt-generator** | Turns a vague ask into a rigorous, grounded, token-efficient prompt — anti-hallucination + anti-tokenmaxing + strict agent rules baked in. |
| **architect** | Produces a production-grade design doc set (domain model + invariants → failure-path design → API contracts → NFRs → sequenced workstream) *before* any code. |
| **review-swarm** | Local, free, multi-specialist review of the working diff via parallel subagents, with adversarial verification and a ranked, evidence-backed report. |
| **ask-the-council** | Convenes a panel of opinionated advisors forced to disagree, then a Chairman who commits to one recommendation with explicit tradeoffs. |
| **up-to-date** | Preflight sync + situational-awareness brief before you start work. Read-only by default; never touches a dirty tree without your OK. |
| **ponytail** | Lazy-senior-dev mode: the simplest, shortest solution that actually works. (Vendored from [DietrichGebert/ponytail](https://github.com/DietrichGebert/ponytail), MIT.) |

## Install

In Claude Code:

```text
/plugin marketplace add alonbaron/claude-skills
/plugin install alon-skills@alonbaron
```

That's it — all six skills are now available in every project on that machine.

## Use

Two ways to run any skill:

1. **Slash command** — `/alon-skills:architect a playdate service`,
   `/ponytail ultra`, `/review-swarm staged`, `/ask-the-council SSE vs WebSockets`
   (add `deep` for the full panel), `/up-to-date docs`.
2. **Just describe the task** — each skill auto-triggers on its phrases, e.g.
   "spec this out before we build", "swarm review this diff", "be lazy here",
   "catch me up on the repo", "ask the council whether…".

## Update

```text
/plugin marketplace update alonbaron
```

This bundle pins no version, so each new commit is automatically the latest —
an update pulls whatever is on `main`.

## Manage

```text
/plugin list                          # see what's installed
/plugin disable alon-skills@alonbaron # turn off without uninstalling
/plugin uninstall alon-skills@alonbaron
```

## License

MIT — see [LICENSE](LICENSE). The `ponytail` skill is third-party (MIT, ©
Dietrich Gebert) and redistributed unmodified with attribution.
