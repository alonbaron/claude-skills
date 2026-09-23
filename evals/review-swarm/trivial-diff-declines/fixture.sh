#!/usr/bin/env bash
set -e
git init -q .

mkdir -p src
cat > src/users.js <<'EOF'
function getUser(userId) {
  // recieve the user record
  return db.query("SELECT * FROM users WHERE id = ?", [userId]);
}
module.exports = { getUser };
EOF

cat > src/orders.js <<'EOF'
function getOrders(userId) {
  return db.query("SELECT * FROM orders WHERE user_id = ?", [userId]);
}
module.exports = { getOrders };
EOF

cat > src/session.js <<'EOF'
function loadSession(userId) {
  return sessions.get(userId);
}
module.exports = { loadSession };
EOF

git add -A
git -c user.name=fixture -c user.email=fixture@example.com commit -q -m "add user lookup helpers" || true

# Leave an uncommitted rename (userId -> accountId) plus a comment typo fix,
# so the working tree shows a trivial diff when the skill's git-status
# injection runs.
cat > src/users.js <<'EOF'
function getUser(accountId) {
  // receive the user record
  return db.query("SELECT * FROM users WHERE id = ?", [accountId]);
}
module.exports = { getUser };
EOF

cat > src/orders.js <<'EOF'
function getOrders(accountId) {
  return db.query("SELECT * FROM orders WHERE user_id = ?", [accountId]);
}
module.exports = { getOrders };
EOF

cat > src/session.js <<'EOF'
function loadSession(accountId) {
  return sessions.get(accountId);
}
module.exports = { loadSession };
EOF
