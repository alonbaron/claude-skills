#!/usr/bin/env bash
set -e

git init -q .
git checkout -q -B main

cat > README.md <<'EOF'
# csv-tools

Personal scratch scripts, not pushed anywhere.
EOF
git add README.md
git -c user.name=fixture -c user.email=fixture@example.com commit -q -m "start scratch notes"

# No `git remote add` -- this repo genuinely has no remote configured.
