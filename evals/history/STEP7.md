# alon-skills v3.2.0 step 7: newest models, stage-feed tracker, clean re-measurement (2026-10-12)

Continues `STEP6.md`. Branch `v3.2-models-tracker-evals`. This file is the durable state for
phases P1-P5: each phase reads it first and updates it last.

## 1. Aliases (P1, 2026-10-12)

Probe, run from a scratch directory: `claude -p --model <alias> --effort low --output-format json "Reply with only: ok"`.
Resolved id and effort are read from the session transcript (`~/.claude/projects/<project>/<session>.jsonl`),
the `assistant` record's `message.model` and `effort` fields. All four replied `ok`, $0.77 API-equivalent in total.

| alias | resolved id | effort recorded | CLI | date |
|---|---|---|---|---|
| fable | claude-fable-5-1 | yes (`low`) | 2.1.296 | 2026-10-12 |
| opus | claude-opus-5-5 | yes (`low`) | 2.1.296 | 2026-10-12 |
| sonnet | claude-sonnet-5-5 | yes (`low`) | 2.1.296 | 2026-10-12 |
| haiku | claude-haiku-5-5 | yes (`low`) | 2.1.296 | 2026-10-12 |

Change since `STEP5.md` section 12 (2026-09-29, CLI 2.1.284): `haiku` moved from
`claude-haiku-4-5-20251001`, which records no effort, to `claude-haiku-5-5`, which does.
