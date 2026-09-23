#!/usr/bin/env bash
set -e

cat > SOURCE_OF_TRUTH.md <<'EOF'
# Source of Truth — Auth Service

## Scope
Cloudflare Workers auth service (Hono + D1). Issues and validates session
tokens for POST /login, POST /logout, GET /session.

## Domain model
- `users` (D1): id, email, password_hash, created_at
- `sessions` (D1): id, user_id, token, expires_at

## Invariants
| # | Invariant | Enforced at |
|---|---|---|
| 1 | Password hashes use scrypt, never stored plaintext | app layer (hash on write) + DB column has no plaintext default |
| 2 | A session token is single-use per refresh | app layer (rotate on use) + DB unique index on token |

## Decisions
- **Decision:** D1 over KV for sessions. **Why:** need a relational lookup by user_id for "log out everywhere". **Alternative rejected:** KV (no secondary index).
EOF

cat > ARCHITECTURE_ROADMAP.md <<'EOF'
# Architecture Roadmap — Auth Service

Version 0.3 · Status: in development · Owner: Alon

## 0. Executive context
Auth service backing the main app. Hono on Cloudflare Workers, D1 for storage.

## 1. Tech stack
| Layer | Tech | Role |
|---|---|---|
| Runtime | Cloudflare Workers | edge compute |
| Framework | Hono | routing/middleware |
| Storage | D1 | users, sessions |

## 2. Data schema
See SOURCE_OF_TRUTH.md domain model.

## 3. Backend — API contract
| Method | Path | Auth | Notes |
|---|---|---|---|
| POST | /login | none | issues session token |
| POST | /logout | session | revokes token |
| GET | /session | session | returns current user |

## 5. Execution phases
Phase 1 (done): login/logout/session. Phase 2 (in progress): password reset.

## 6. Non-functional requirements
p95 login latency < 150ms.
EOF

cat > TODO_WORKFLOW.md <<'EOF'
# TODO — Auth Service

| # | Task | Architecture Ref | Status | Branch |
|---|---|---|---|---|
| 1 | Login/logout/session endpoints | ARCHITECTURE_ROADMAP.md §3 | [MERGED/DONE] | main |
| 2 | Password reset flow | ARCHITECTURE_ROADMAP.md §3 | [ ] | - |
EOF

cat > CLAUDE.md <<'EOF'
# Auth Service — Rules

Stack: Cloudflare Workers + Hono + D1.

## Commands
| Scope | Install | Test | Lint | Format |
|---|---|---|---|---|
| root | `npm install` | `npm test` | `npm run lint` | `npm run format` |

## Reference precedence
- Apex truth: SOURCE_OF_TRUTH.md
- Architecture: ARCHITECTURE_ROADMAP.md
- Tasks: TODO_WORKFLOW.md
EOF

git init -q .
git add -A
git -c user.name=fixture -c user.email=fixture@example.com commit -q -m "auth service docs, no rate limiting yet"
