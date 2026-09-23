"""Build a claude-plugin-eval trigger suite from trigger-evals/<skill>.json sets.
Usage: python gen_trigger_suite.py <sets_dir> <out_eval_dir>
Each query becomes a case with one grader: tool_used Skill (min 1, or min 0/max 0 for negatives), arm both."""
import json, os, re, sys, shutil
sets_dir, out = sys.argv[1], sys.argv[2]
if os.path.isdir(out): shutil.rmtree(out)
n = 0
for fn in sorted(os.listdir(sets_dir)):
    if not fn.endswith('.json'): continue
    skill = fn[:-5]
    for i, q in enumerate(json.load(open(os.path.join(sets_dir, fn), encoding='utf-8'))):
        kind = 'yes' if q['should_trigger'] else 'no'
        case = f"{skill}-{kind}-{i:02d}"
        d = os.path.join(out, case); os.makedirs(os.path.join(d, 'graders'))
        with open(os.path.join(d, 'prompt.md'), 'w', encoding='utf-8') as f:
            f.write(f"---\nmax_turns: 6\ntimeout_seconds: 180\ntags: [trigger, {skill}, {kind}]\nallowed_tools: [Read, Glob, Grep, Skill]\n---\n\n{q['query']}\n")
        bounds = "min: 1\n" if q['should_trigger'] else "min: 0\nmax: 0\n"
        with open(os.path.join(d, 'graders', 'fired.md'), 'w', encoding='utf-8') as f:
            f.write(f"---\ntype: tool_used\ntool: Skill\ninput_match: '\"skill\"\s*:\s*\"(?:[\w-]+:)?{re.escape(skill)}\"'\n{bounds}arm: both\n---\n")
        n += 1
print('cases', n)
