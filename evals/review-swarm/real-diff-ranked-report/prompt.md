---
name: real-diff-ranked-report
description: review-swarm should spawn sonnet reviewers and opus verifiers, catch the N+1 query and the missing test, and return a ranked report without editing files
tags: [review-swarm, real-diff, model-routing, needs-scaffold]
max_turns: 40
timeout_seconds: 900
expected_outcome: Skill fires, spawns reviewer subagents on sonnet and verifier subagents on opus, and returns a ranked Blockers/Should-fix/Nits report surfacing the N+1 query and the missing zero-orders test, with no Edit or Write calls.
---

I added a new `/orders/<user_id>` endpoint in `app/routes.py`: it pulls a user's orders with `Order.query.filter_by(user_id=user_id).all()`, then loops over them and calls `db.session.query(Item).get(order.item_id)` once per order. There's no test covering a user with zero orders. Haven't committed it yet. Run review-swarm on this diff before I open the PR.
