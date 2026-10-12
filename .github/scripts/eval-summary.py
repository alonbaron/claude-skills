"""Print per-case, per-grader results of a `claude plugin eval --json` file, for CI logs.

A case is INVALID when one of its runs failed, or one of its graders threw, for a reason outside the case
(a usage, session or Fable limit, auth, the network, a lost judge call): its score measures nothing, so it is
named for a re-run and left out of the valid-only aggregates. A case is TRUNCATED when a run stopped on the
case's own max_turns or timeout_seconds: that is the case's budget at work, so it counts, flagged.
"""
import json, re, sys

sys.stdout.reconfigure(encoding="utf-8", errors="replace")
d = json.load(open(sys.argv[1], encoding="utf-8"))


def flags(c):
    """The INVALID and TRUNCATED lines of one case, each naming the arm and run it is about."""
    invalid, truncated = [], []
    for arm, runs in c["arms"].items():
        for i, r in enumerate(runs or []):
            at = f"{arm}#{i}"
            err = (r.get("error") or "").strip()
            if err:
                # The runner's own words for the two budgets: "Reached maximum number of turns (N)" (the CLI's
                # max-turns stop) and "timed out after Ns"; either counts only when N is this case's budget.
                turns = re.search(r"Reached maximum number of turns \((\d+)\)", err)
                clock = re.search(r"\btimed out after (\d+)s\b", err)
                if turns and int(turns.group(1)) == c.get("maxTurns"):
                    truncated.append(f"{at}: {err[:200]} ({r.get('turns')} turns, cap {c['maxTurns']})")
                elif clock and int(clock.group(1)) == c.get("timeoutSeconds"):
                    truncated.append(f"{at}: {err[:200]}")
                else:
                    invalid.append(f"{at} run: {err[:200]}")
            if r.get("skippedPaidGraders"):
                invalid.append(f"{at}: paid graders skipped (cost ceiling)")
            for g in r.get("graders", []):
                why = (g.get("explanation") or "").strip()
                if why.startswith("grader threw"):
                    invalid.append(f"{at} grader {g['name']}: {why[:200]}")
    return invalid, truncated


def where(c):
    """<skill>/<case>, from the case's directory."""
    return "/".join(c["dir"].replace("\\", "/").rstrip("/").split("/")[-2:])


mean = lambda rs: f"{sum(r['score'] for r in rs) / len(rs):.2f}" if rs else "-"
cases = [(c, *flags(c)) for c in d["cases"]]
bad = [c for c, invalid, _ in cases if invalid]
good = [c for c, invalid, _ in cases if not invalid]
cut = [c for c, invalid, truncated in cases if truncated and not invalid]

print(f"valid {len(good)} of {len(cases)}" + (f" ({len(cut)} TRUNCATED: {' '.join(where(c) for c in cut)})" if cut else ""))
print("re-run: " + (" ".join(where(c) for c in bad) or "none"))
if d.get("partial"):
    print("partial: the runner stopped before every case ran; cases it never started are not in this file")
print(f"cost ${d['costUsd']:.2f}  runner aggregates over all {len(cases)} cases"
      + (f", {len(bad)} of them INVALID" if bad else "") + f": {json.dumps(d['aggregates'])}")
if bad:
    if good:
        t = d.get("suite", {}).get("threshold", 0.7)
        a = [c["aggregates"] for c in good]
        n = len(a)
        print(f"valid-only aggregates ({n} cases): score {sum(x['score'] for x in a) / n:.2f}"
              + (f"  mean delta {sum(x['delta'] for x in a) / n:+.2f}" if all("delta" in x for x in a) else "")
              + f"  {sum(x['score'] >= t for x in a)} of {n} at {t}")
    else:
        print("valid-only aggregates: none, every case is INVALID")

for c, invalid, truncated in cases:
    w, wo = c["arms"].get("with") or [], c["arms"].get("without") or []
    flag = "  INVALID" if invalid else "  TRUNCATED" if truncated else ""
    print(f"\n== {c['name']}  with {mean(w)}  without {mean(wo)}{flag}")
    for line in invalid:
        print(f"   INVALID {line}")
    for line in truncated:
        print(f"   TRUNCATED {line}")
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
