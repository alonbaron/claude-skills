"""Print per-case, per-grader results of a `claude plugin eval --json` file, for CI logs."""
import json, sys

d = json.load(open(sys.argv[1]))
print(f"cost ${d['costUsd']:.2f}  aggregates {json.dumps(d['aggregates'])}")
for c in d["cases"]:
    w, wo = c["arms"].get("with", []), c["arms"].get("without", [])
    mean = lambda rs: f"{sum(r['score'] for r in rs) / len(rs):.2f}" if rs else "-"
    print(f"\n== {c['name']}  with {mean(w)}  without {mean(wo)}")
    for r in w + wo:
        if r.get("error"):
            print(f"   error: {r['error'][:200]}")
    for name in [g["name"] for g in (w[0]["graders"] if w else [])]:
        marks = lambda rs: "".join("P" if g["passed"] else "." for r in rs for g in r["graders"] if g["name"] == name)
        print(f"   {name:34} with {marks(w):4} without {marks(wo)}")
    for i, r in enumerate(w):
        for g in r["graders"]:
            if not g["passed"]:
                ev = (g.get("evidence") or "").replace("\n", " | ")[:700]
                print(f"   FAIL with#{i} {g['name']}: {g.get('explanation', '')[:160]}")
                if ev:
                    print(f"      evidence: {ev}")
