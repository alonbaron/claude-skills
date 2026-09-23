#!/usr/bin/env bash
set -e

# Real bare remote, cloned into the (empty) workspace -- matches how a
# shared repo actually looks, not a synthesized .git.
REMOTE_DIR="$(mktemp -d)"
git init -q --bare "$REMOTE_DIR"

git clone -q "$REMOTE_DIR" .
git checkout -q -B main

cat > README.md <<'EOF'
# TenderTrack API
EOF
mkdir -p src
cat > src/api_client.py <<'EOF'
def fetch_tenders():
    return []
EOF
git add README.md src/api_client.py
git -c user.name=fixture -c user.email=fixture@example.com commit -q -m "initial commit"
git push -q -u origin main

cat >> src/api_client.py <<'EOF'

def fetch_tender(tender_id):
    return {}
EOF
git add src/api_client.py
git -c user.name=fixture -c user.email=fixture@example.com commit -q -m "add fetch_tender"
git push -q origin main

cat > src/pagination.py <<'EOF'
def paginate(items, page, size):
    start = (page - 1) * size
    return items[start:start + size]
EOF
git add src/pagination.py
git -c user.name=fixture -c user.email=fixture@example.com commit -q -m "add pagination helper"
git push -q origin main

# Fall behind by 2: HEAD moves back, but the origin/main tracking ref (set by
# the pushes above) still points at the real tip, so rev-list sees "behind 2".
git reset -q --hard HEAD~2

# Leave an uncommitted, tracked-file edit -- the "unfinished CSV/API work
# from yesterday" the tree should be reported as dirty for.
cat >> src/api_client.py <<'EOF'

# TODO: wire up new pagination params
EOF
