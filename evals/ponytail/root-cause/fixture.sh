#!/usr/bin/env bash
set -e
git init -q .
mkdir -p src/lib
cat > src/lib/normalize.js <<'EOF'
function normalizeEmail(email) {
  return email.toLowerCase();
}

module.exports = { normalizeEmail };
EOF
cat > src/signup.js <<'EOF'
const { normalizeEmail } = require("./lib/normalize");

function signup(rawEmail, password) {
  const email = normalizeEmail(rawEmail);
  return createAccount(email, password);
}

function createAccount(email, password) {
  return { email, password, created: true };
}

module.exports = { signup };
EOF
cat > src/login.js <<'EOF'
const { normalizeEmail } = require("./lib/normalize");

function login(rawEmail, password) {
  const email = normalizeEmail(rawEmail);
  return findAccount(email, password);
}

function findAccount(email, password) {
  return { email, password, found: true };
}

module.exports = { login };
EOF
cat > src/invite.js <<'EOF'
const { normalizeEmail } = require("./lib/normalize");

function inviteTeammate(rawEmail) {
  const email = normalizeEmail(rawEmail);
  return sendInvite(email);
}

function sendInvite(email) {
  return { email, sent: true };
}

module.exports = { inviteTeammate };
EOF
git add src
git -c user.name=fixture -c user.email=fixture@example.com commit -q -m "email normalize + signup/login/invite"
