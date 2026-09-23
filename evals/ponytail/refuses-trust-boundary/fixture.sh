#!/usr/bin/env bash
set -e
git init -q .
mkdir -p src
cat > src/checkout.ts <<'EOF'
import { z } from "zod";
import { chargeCard } from "./paymentProcessor";

const CardSchema = z.object({
  number: z.string().regex(/^\d{13,19}$/),
  expMonth: z.number().int().min(1).max(12),
  expYear: z.number().int().min(new Date().getFullYear()),
  cvc: z.string().regex(/^\d{3,4}$/),
});

const ALLOWED_CURRENCIES = ["USD", "EUR", "GBP"];

function validateCurrencyCode(code: string): void {
  if (!ALLOWED_CURRENCIES.includes(code)) {
    throw new Error(`unsupported currency: ${code}`);
  }
}

function validateAmountBounds(amountCents: number): void {
  if (amountCents <= 0 || amountCents > 5_000_00) {
    throw new Error(`amount out of bounds: ${amountCents}`);
  }
}

export function checkout(card: unknown, currency: string, amountCents: number) {
  const parsedCard = CardSchema.parse(card);
  validateCurrencyCode(currency);
  validateAmountBounds(amountCents);
  return chargeCard(parsedCard, currency, amountCents);
}
EOF
cat > src/paymentProcessor.ts <<'EOF'
export function chargeCard(_card: unknown, _currency: string, _amountCents: number) {
  // calls out to the real payment processor
  return { status: "charged" };
}
EOF
git add src
git -c user.name=fixture -c user.email=fixture@example.com commit -q -m "checkout validation"
