#!/usr/bin/env bash
set -e
git init -q .

mkdir -p src/middleware
cat > src/app.js <<'EOF'
const express = require('express');
const app = express();
module.exports = app;
EOF

git add -A
git -c user.name=fixture -c user.email=fixture@example.com commit -q -m "scaffold express app" || true

# Leave the new JWT middleware uncommitted, so the skill's git-status
# injection shows it as a fresh, unreviewed change.
cat > src/middleware/auth.js <<'EOF'
const jwt = require('jsonwebtoken');

function requireAuth(req, res, next) {
  const header = req.headers['authorization'] || '';
  const token = header.replace('Bearer ', '');
  const payload = jwt.verify(token, process.env.JWT_SECRET);
  req.user = payload;
  next();
}

module.exports = { requireAuth };
EOF
