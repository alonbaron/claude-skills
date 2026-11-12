#!/usr/bin/env bash
set -e
git init -q .

mkdir -p app tests
cat > app/models.py <<'EOF'
class Order:
    """Order rows, keyed by user_id, with an item_id per row."""
    query = None  # ORM manager placeholder


class Item:
    """Catalog item, looked up by id."""
    query = None
EOF

cat > app/routes.py <<'EOF'
from flask import Flask, jsonify
from app.models import Order, Item

app = Flask(__name__)
EOF

cat > tests/test_routes.py <<'EOF'
def test_placeholder():
    assert True
EOF

# The spec the diff is reviewed against. Row 1.2 asks for two things the
# uncommitted endpoint below does not do: newest first, and at most 50 orders.
cat > TODO_WORKFLOW.md <<'EOF'
# TODO_WORKFLOW

Status: `[ ]` · `[IN PROGRESS]` · `[FINISHED - PENDING MERGE]` · `[MERGED/DONE]` · `[BLOCKED]`

## Phase 1: read API

| # | Task | Architecture Ref | Status | Branch |
|---|------|------------------|--------|--------|
| 1.1 | Scaffold the Flask app and the placeholder models | - | [MERGED/DONE] | main |
| 1.2 | `GET /orders/<user_id>`: a user's orders as a JSON list of `{order_id, item_name}`, newest first, at most 50 per response | - | [IN PROGRESS] | main |
| 1.3 | `GET /items/<item_id>`: one catalog item as JSON | - | [ ] | - |
EOF

git add -A
git -c user.name=fixture -c user.email=fixture@example.com commit -q -m "scaffold flask app" || true

# Leave the new endpoint uncommitted, so the skill's git-status/diff-stat
# injection shows it as the working change to review.
cat > app/routes.py <<'EOF'
from flask import Flask, jsonify
from app import db
from app.models import Order, Item

app = Flask(__name__)


@app.route('/orders/<user_id>')
def get_orders(user_id):
    orders = Order.query.filter_by(user_id=user_id).all()
    result = []
    for order in orders:
        item = db.session.query(Item).get(order.item_id)
        result.append({"order_id": order.id, "item_name": item.name})
    return jsonify(result)
EOF
