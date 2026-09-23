#!/usr/bin/env bash
set -e

REMOTE_DIR="$(mktemp -d)"
git init -q --bare "$REMOTE_DIR"

git clone -q "$REMOTE_DIR" .
git checkout -q -B main

cat > README.md <<'EOF'
# ShiftManager
EOF
mkdir -p src
cat > src/payments.py <<'EOF'
def charge(amount):
    return True
EOF
git add README.md src/payments.py
git -c user.name=fixture -c user.email=fixture@example.com commit -q -m "initial commit"
git push -q -u origin main

# Branch for the feature -- never pushed, so it has no upstream tracking ref.
git checkout -q -b feature/payment-retry

cat > src/retry.py <<'EOF'
def retry_with_backoff(fn):
    return fn()
EOF
git add src/retry.py
git -c user.name=fixture -c user.email=fixture@example.com commit -q -m "start retry-backoff logic"

# main moves ahead on the remote after the feature branch forked.
git checkout -q main
cat >> src/payments.py <<'EOF'

def refund(amount):
    return True
EOF
git add src/payments.py
git -c user.name=fixture -c user.email=fixture@example.com commit -q -m "add refund handling"
git push -q origin main

# Land back on the unpushed feature branch -- this is where the session
# starts. No @{upstream} exists for it; origin/main is one commit ahead of
# where it forked.
git checkout -q feature/payment-retry
