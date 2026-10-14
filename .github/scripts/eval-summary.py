"""Print per-case, per-grader results of a `claude plugin eval --json` file, for CI logs.

    python3 eval-summary.py <result.json> [<eval dir> [<runs per arm>]]

A case is INVALID when one of its runs failed, or one of its graders threw, for a reason outside the case
(a usage, session or Fable limit, auth, the network, a lost judge call), or when an arm has fewer runs than
asked for: its score measures nothing, so it is named for a re-run and left out of the valid-only aggregates.
A case is TRUNCATED when a run stopped on the case's own max_turns or timeout_seconds: that is the case's
budget at work, so it counts, flagged. With <eval dir>, a case folder in it (one holding case.yaml) that is
not in the results is NOT RUN, and named for a re-run too: a run the CLI stopped early leaves out the cases
it never started. <runs per arm> is the `--runs` the eval ran with (the JSON's runsPerCase is the case
file's, which `--runs` overrides); without it, the most runs any arm in the file has.
"""
import glob, json, os, re, sys

sys.stdout.reconfigure(encoding="utf-8", errors="replace")
d = json.load(open(sys.argv[1], encoding="utf-8"))
eval_dir = sys.argv[2] if len(sys.argv) > 2 else None
expected = int(sys.argv[3]) if len(sys.argv) > 3 else max((len(r or []) for c in d["cases"] for r in c["arms"].values()), default=0)


def one(text, n):
    """Text from a run or a grader as one line of at most n characters: no newline that could start a
    workflow command (`::`) in the Actions log, no escape or other control character."""
    return re.sub(r"[\s\x00-\x1f\x7f-\x9f]+", " ", text or "").strip()[:n]


def flags(c):
    """The INVALID and TRUNCATED lines of one case, each naming the arm and run it is about."""
    invalid, truncated = [], []
    arms = ["with", "without"] if d.get("suite", {}).get("ablation") == "with-without" else ["with"]
    for arm in arms:
        got = len(c["arms"].get(arm) or [])
        if got < expected:
            invalid.append(f"{arm}: {got} of {expected} runs")
    for arm, runs in c["arms"].items():
        for i, r in enumerate(runs or []):
            at = f"{arm}#{i}"
            err = one(r.get("error"), 200)
            if err:
                # The runner's own words for the two budgets: "Reached maximum number of turns (N)" (the CLI's
                # max-turns stop) and "timed out after Ns"; either counts only when N is this case's budget.
                turns = re.search(r"Reached maximum number of turns \((\d+)\)", err)
                clock = re.search(r"\btimed out after (\d+)s\b", err)
                if turns and int(turns.group(1)) == c.get("maxTurns"):
                    truncated.append(f"{at}: {err} ({r.get('turns')} turns, cap {c['maxTurns']})")
                elif clock and int(clock.group(1)) == c.get("timeoutSeconds"):
                    truncated.append(f"{at}: {err}")
                else:
                    invalid.append(f"{at} run: {err}")
            if r.get("skippedPaidGraders"):
                invalid.append(f"{at}: paid graders skipped (cost ceiling)")
            for g in r.get("graders", []):
                if threw(g):
                    invalid.append(f"{at} grader {g['name']}: {one(g.get('explanation'), 200)}")
    return invalid, truncated


def threw(g):
    return (g.get("explanation") or "").strip().startswith("grader threw")


def where(path):
    """<skill>/<case>, from a case's directory."""
    return "/".join(path.replace("\\", "/").rstrip("/").split("/")[-2:])


mean = lambda rs: f"{sum(r['score'] for r in rs) / len(rs):.2f}" if rs else "-"
cases = [(c, *flags(c)) for c in d["cases"]]
bad = [c for c, invalid, _ in cases if invalid]
good = [c for c, invalid, _ in cases if not invalid]
cut = [c for c, invalid, truncated in cases if truncated and not invalid]
ran = {where(c["dir"]) for c in d["cases"]}
folders = sorted(where(os.path.dirname(p)) for p in glob.glob(os.path.join(eval_dir, "*", "*", "case.yaml"))) if eval_dir else []
not_run = [f for f in folders if f not in ran]

if d.get("partial"):
    why = {"interrupted": "interrupted", "cost_ceiling": "cost ceiling hit", "auth_failed": "authentication failed"}
    print(f"PARTIAL: the runner stopped early ({why.get(d.get('partialReason'), d.get('partialReason') or 'no reason given')});"
          " cases it never started are not in the results" + ("" if eval_dir else " (pass the eval dir to name them)"))
total = len(cases) + len(not_run)
print(f"valid {len(good)} of {total}" + (f" ({len(cut)} TRUNCATED: {' '.join(where(c['dir']) for c in cut)})" if cut else "")
      + (f" ({len(not_run)} NOT RUN)" if not_run else ""))
print("re-run: " + (" ".join([where(c["dir"]) for c in bad] + not_run) or "none"))
print(f"cost ${d['costUsd']:.2f}  runner aggregates over the {len(cases)} cases in the results"
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
            # A grader that threw is on an INVALID line already.
            if not g["passed"] and not threw(g):
                ev = one((g.get("evidence") or "").replace("\n", " | "), 700)
                print(f"   FAIL with#{i} {g['name']}: {one(g.get('explanation'), 160)}")
                if ev:
                    print(f"      evidence: {ev}")
for f in not_run:
    print(f"\n== {f.split('/')[-1]}  NOT RUN")
