#!/usr/bin/env bash
set -e

mkdir -p src/routes

cat > src/routes/webhooks.js <<'EOF'
// Stripe webhook handler
import { Hono } from 'hono'

const app = new Hono()

// Verifies the Stripe signature and marks the order paid.
app.post('/webhooks/stripe', async (c) => {
  const sig = c.req.header('stripe-signature')
  const body = await c.req.text()
  const event = verifyStripeSignature(body, sig)
  if (event.type === 'checkout.session.completed') {
    await markOrderPaid(event.data.object.id)
  }
  return c.json({ received: true })
})

export default app
EOF

cat > SOURCE_OF_TRUTH.md <<'EOF'
# Source of Truth — Storefront API

## Scope
Cloudflare Workers storefront API (Hono). Handles checkout and order status.

## Invariants
| # | Invariant | Enforced at |
|---|---|---|
| 1 | An order is marked paid only after a verified Stripe signature | webhook handler (signature check) + DB unique constraint on payment intent id |
EOF

cat > ARCHITECTURE_ROADMAP.md <<'EOF'
# Architecture Roadmap — Storefront API

Version 0.4 · Status: in development · Owner: Alon

## 0. Executive context
Storefront checkout API, Hono on Cloudflare Workers.

## 3. Backend — API contract
| Method | Path | Auth | Notes |
|---|---|---|---|
| POST | /checkout | session | creates a Stripe checkout session |
| GET | /orders/:id | session | returns order status |
EOF

cat > TODO_WORKFLOW.md <<'EOF'
# TODO — Storefront API

| # | Task | Architecture Ref | Status | Branch |
|---|---|---|---|---|
| 1 | Checkout + order status | ARCHITECTURE_ROADMAP.md §3 | [MERGED/DONE] | main |
EOF

cat > CLAUDE.md <<'EOF'
# Storefront API — Rules

Stack: Cloudflare Workers + Hono.

## Reference precedence
- Apex truth: SOURCE_OF_TRUTH.md
- Architecture: ARCHITECTURE_ROADMAP.md
- Tasks: TODO_WORKFLOW.md
EOF

git init -q .
git add -A
git -c user.name=fixture -c user.email=fixture@example.com commit -q -m "add stripe webhook handler, roadmap not updated"
