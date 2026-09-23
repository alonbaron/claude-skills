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
