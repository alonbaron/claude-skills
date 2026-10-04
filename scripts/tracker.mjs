#!/usr/bin/env node
// Stage tracker for a Workflow run (the build loop or any other): one row per subagent with its
// phase, outcome, label, model alias and resolved id, effort, duration, tool calls, output tokens,
// its place on the run's timeline, and its result in one line. Rendered from the run's own files
// under ~/.claude/projects/<project>/<session>/subagents/workflows/<run>/: journal.jsonl (stages and
// results), agent-<id>.meta.json (the alias asked for) and agent-<id>.jsonl (what actually ran).
// That layout is Claude Code internal; when it moves, this script says so instead of guessing.
//
//   node <plugin-root>/scripts/tracker.mjs                      newest run of the newest session, to ./tracker.html
//   node <plugin-root>/scripts/tracker.mjs --run <run dir>       that run
//   node <plugin-root>/scripts/tracker.mjs --session <id>        newest run of that session
//   node <plugin-root>/scripts/tracker.mjs --out <file.html>     where the page goes
//   node <plugin-root>/scripts/tracker.mjs --png <file.png>      also a screenshot (needs playwright with chromium;
//                                                                --playwright <path to its package> when not resolvable)
//   node <plugin-root>/scripts/tracker.mjs --watch               re-render every 5 s while the run goes on
// The workflow-watch mod (mods/workflow-watch) draws the same rows live inside Claude Code.

import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { basename, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { setTimeout as sleep } from "node:timers/promises";

const argv = process.argv.slice(2);
const flag = (n) => argv.includes(n);
const val = (n, d) => {
  const i = argv.indexOf(n);
  return i >= 0 && i + 1 < argv.length ? argv[i + 1] : d;
};
if (flag("--help") || flag("-h")) {
  console.log(readFileSync(new URL(import.meta.url)).toString().split("\n").slice(1, 16).map((l) => l.replace(/^\/\/ ?/, "")).join("\n"));
  process.exit(0);
}

// ---------- locate the run ----------
function newestRun(sessionId) {
  const projects = join(homedir(), ".claude", "projects");
  let best = null;
  for (const proj of safeList(projects)) {
    for (const sess of safeList(join(projects, proj))) {
      if (sessionId && sess !== sessionId) continue;
      const wf = join(projects, proj, sess, "subagents", "workflows");
      for (const run of safeList(wf)) {
        const j = join(wf, run, "journal.jsonl");
        try {
          const m = statSync(j).mtimeMs;
          if (!best || m > best.mtime) best = { dir: join(wf, run), mtime: m };
        } catch {}
      }
    }
  }
  return best ? best.dir : null;
}
function safeList(p) {
  try {
    return readdirSync(p);
  } catch {
    return [];
  }
}
const runDir = val("--run", "") ? resolve(val("--run")) : newestRun(val("--session", ""));
if (!runDir || !existsSync(join(runDir, "journal.jsonl"))) {
  console.error(runDir ? `no journal.jsonl in ${runDir}` : "no workflow run found under ~/.claude/projects (the journal layout may have moved)");
  process.exit(2);
}

// ---------- read it ----------
const jsonLines = (p) =>
  readFileSync(p, "utf8")
    .split("\n")
    .filter(Boolean)
    .flatMap((l) => {
      try {
        return [JSON.parse(l)];
      } catch {
        return [];
      }
    });
const count = (a) => (Array.isArray(a) ? a.length : 0);
const str = (v, n = 90) => String(v ?? "").replace(/\s+/g, " ").slice(0, n);
function summarize(label, r) {
  const role = String(label).split(":")[0];
  if (typeof r === "string") return str(r, 120);
  if (!r || typeof r !== "object") return "(no result)";
  switch (role) {
    case "plan":
      if (r.staleBlocked) return `stale row ${r.staleBlocked.taskId}: ${str(r.staleBlocked.reason)}`;
      return r.taskId ? `picked ${r.taskId} on ${r.branch}${r.resuming ? " (resuming)" : ""}` : `stop: ${str(r.stopReason)}`;
    case "scout":
      return `${count(r.files)} files, ${count(r.tests)} tests, ${count(r.docSections)} doc sections`;
    case "spec":
      return r.stopReason ? `stop: ${str(r.stopReason)}` : `spec written; docs changed ${count(r.docsChanged)}; unverified APIs ${count(r.unverifiedApis)}`;
    case "research":
      return `research at ${r.researchPath}; still unverified ${count(r.unverifiedRemaining)}`;
    case "build":
      return `ok=${r.ok} commits=${count(r.commits)} tests=${r.testsPassed ? "pass" : "FAIL"} lint=${r.lintPassed ? "pass" : "FAIL"} deviations=${count(r.deviations)}${r.blockedReason ? ` BLOCKED: ${str(r.blockedReason)}` : ""}`;
    case "measure":
      return `${r.filesChanged} files, ${r.linesChanged} lines${r.docsOnly ? ", docs only" : ""}${r.touchesTrustBoundary ? ", trust boundary" : ""}`;
    case "refute": {
      const b = r.blocking || [];
      const head = `${String(r.verdict).toUpperCase()} blocking=${b.length} advisory=${count(r.advisory)}`;
      return b.length ? `${head} | ${b[0].file}: ${str(b[0].issue, 110)}` : head;
    }
    case "arbiter":
      return (r.rulings || []).map((x) => `${x.key} ${x.ruling}: ${str(x.reason, 100)}`).join("; ") || "no rulings";
    case "fix":
      return `fixed=${count(r.fixed)} disputed=${count(r.notFixed)} commits=${count(r.commits)}` + (r.notFixed || []).map((x) => ` | disputed ${x.key}: ${str(x.reason, 100)}`).join("");
    case "close":
      return r.ok ? `row updated, commit ${r.commit || "?"}` : "close reported not ok";
    default:
      return str(JSON.stringify(r), 120);
  }
}
function readRun(dir) {
  const stages = [];
  const byKey = new Map();
  for (const e of jsonLines(join(dir, "journal.jsonl"))) {
    if (e.type === "started" && e.key) {
      const s = { key: e.key, agentId: e.agentId, label: e.label || "", phase: e.phase || "", result: undefined, isDone: false };
      stages.push(s);
      byKey.set(e.key, s);
    } else if (e.type === "result" && byKey.has(e.key)) {
      Object.assign(byKey.get(e.key), { result: e.result, isDone: true });
    }
  }
  for (const s of stages) {
    const meta = join(dir, `agent-${s.agentId}.meta.json`);
    s.alias = existsSync(meta) ? (JSON.parse(readFileSync(meta, "utf8")).model ?? "?") : "?";
    const f = join(dir, `agent-${s.agentId}.jsonl`);
    let first = null, last = null, tools = 0, lastTool = "", outTok = 0;
    const models = new Set(), efforts = new Set();
    if (existsSync(f))
      for (const e of jsonLines(f)) {
        if (e.timestamp) {
          const t = Date.parse(e.timestamp);
          first = first ?? t;
          last = t;
        }
        const msg = e.message || {};
        if (e.type === "assistant") {
          if (msg.model) models.add(msg.model);
          if (e.effort) efforts.add(e.effort);
          outTok += msg.usage?.output_tokens || 0;
        }
        for (const b of Array.isArray(msg.content) ? msg.content : [])
          if (b.type === "tool_use") {
            tools += 1;
            const i = b.input || {};
            lastTool = `${b.name} ${str(i.command || i.file_path || i.pattern || i.description || "", 60)}`;
          }
      }
    Object.assign(s, { start: first, end: s.isDone ? last : Date.now(), tools, lastTool, outTok, model: [...models].join(", ") || "?", effort: [...efforts].join(", ") || "n/a" });
  }
  return stages;
}

// ---------- render ----------
const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const dur = (ms) => (ms == null ? "--:--" : `${String(Math.floor(ms / 60000)).padStart(2, "0")}:${String(Math.floor((ms % 60000) / 1000)).padStart(2, "0")}`);
function verdict(s) {
  if (!s.isDone) return "run";
  const r = s.result;
  if (r == null) return "empty";
  if (typeof r === "object" && (r.verdict === "fail" || r.ok === false || (Array.isArray(r.notFixed) && r.notFixed.length))) return "fail";
  return "ok";
}
function page(dir, stages) {
  const t0 = Math.min(...stages.filter((s) => s.start).map((s) => s.start));
  const t1 = Math.max(...stages.map((s) => s.end ?? t0));
  const total = Math.max(1, t1 - t0);
  const live = stages.filter((s) => !s.isDone).length;
  const tokens = stages.reduce((n, s) => n + s.outTok, 0);
  let prev = null;
  const rows = stages.map((s) => {
    const v = verdict(s);
    const g = { run: "▶", ok: "✓", fail: "!", empty: "✗" }[v];
    const ph = s.phase !== prev ? s.phase : "";
    prev = s.phase;
    const left = s.start ? ((s.start - t0) / total) * 100 : 0;
    const width = s.start ? Math.max(0.8, ((s.end - s.start) / total) * 100) : 0;
    const text = v === "run" ? `${s.tools} calls · ${s.lastTool || "starting"}` : summarize(s.label, s.result);
    return `<tr class="${v}"><td class="ph">${esc(ph)}</td><td class="g">${g}</td><td class="lb">${esc(s.label)}</td><td class="mo"><span class="m ${esc(s.alias)}">${esc(s.alias)}</span><br><small>${esc(s.model)}</small></td><td class="ef ${esc(s.effort)}">${esc(s.effort)}</td><td class="n">${dur(s.start ? s.end - s.start : null)}</td><td class="n">${s.tools}</td><td class="n">${(s.outTok / 1000).toFixed(1)}k</td><td class="bar"><div class="track"><div class="fill" style="left:${left.toFixed(1)}%;width:${width.toFixed(1)}%"></div></div></td><td class="sm">${esc(text).slice(0, 220)}</td></tr>`;
  });
  const state = `${live} running · ${stages.length - live} done · ${dur(total)} elapsed · ${(tokens / 1000).toFixed(1)}k output tokens${live ? "" : " · finished"}`;
  return `<!doctype html><html><head><meta charset="utf-8"><title>${esc(basename(dir))}</title><style>
:root{--bg:#0f1115;--card:#161920;--line:#262b36;--fg:#e6e8ee;--dim:#8a93a6;--acc:#7aa2f7;--ok:#4fcf8a;--bad:#ff7b72;--warn:#f0c35b}
body{margin:0;background:var(--bg);color:var(--fg);font:14px/1.45 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;padding:24px}
.card{background:var(--card);border:1px solid var(--line);border-radius:10px;overflow:hidden;max-width:1240px}
.head{display:flex;justify-content:space-between;align-items:baseline;gap:16px;padding:14px 18px;border-bottom:1px solid var(--line)} .head b{font-size:16px} .head span{color:var(--dim)}
table{border-collapse:collapse;width:100%} td{padding:6px 10px;border-bottom:1px solid #1d212b;vertical-align:top;white-space:nowrap}
tr.hd td{color:var(--dim);font-size:11px;text-transform:uppercase;letter-spacing:.04em;border-bottom:1px solid var(--line)}
td.ph{color:var(--acc);font-weight:600;width:70px} td.g{width:14px;text-align:center} td.lb{width:230px} td.n{color:var(--dim);text-align:right;width:40px}
td.mo{width:150px;line-height:1.2} td.mo small{color:var(--dim);font-size:10.5px} td.ef{width:50px;font-size:12px;color:var(--dim)} td.ef.high{color:#d9ccff} td.ef.low{color:#6b7280}
td.sm{color:var(--dim);white-space:normal;max-width:360px;font-size:12.5px}
tr.ok td.g{color:var(--ok)} tr.fail td.g{color:var(--bad)} tr.run td.g,tr.run td.lb{color:var(--warn)} tr.empty td.g{color:var(--bad)} tr.fail td.sm{color:#f3b5b0}
.m{font-size:11px;padding:1px 6px;border-radius:4px;background:#232838;color:var(--dim)} .m.fable{background:#3b2f6b;color:#d9ccff} .m.opus{background:#2d3f6b;color:#cfe0ff} .m.sonnet{background:#1f4a3a;color:#b9f0d2} .m.haiku{background:#4a3a1f;color:#f3dfae}
td.bar{width:200px} .track{position:relative;height:8px;background:#20242e;border-radius:4px} .fill{position:absolute;top:0;height:8px;border-radius:4px;background:#5b84d6} tr.run .fill{background:var(--warn)} tr.fail .fill{background:var(--bad)}
.foot{padding:10px 18px;color:var(--dim);border-top:1px solid var(--line);font-size:12.5px}
</style></head><body><div class="card">
<div class="head"><b>${esc(basename(dir))}</b><span>${state}</span></div>
<table><tr class="hd"><td>phase</td><td></td><td>stage</td><td>model (alias / resolved)</td><td>effort</td><td class="n">time</td><td class="n">tools</td><td class="n">out tok</td><td>timeline</td><td>result</td></tr>${rows.join("")}</table>
<div class="foot">${esc(dir)} · bars are each stage's start and length over the whole run · out tok = output tokens the stage generated, thinking included · rendered ${new Date().toISOString()}</div>
</div></body></html>`;
}

async function screenshot(html, png) {
  const want = val("--playwright", "playwright");
  let pw;
  try {
    pw = await import(want.includes("/") || want.includes("\\") ? pathToFileURL(resolve(want, "index.mjs")).href : want);
  } catch (e) {
    console.error(`--png needs playwright with chromium (${e.message}); pass --playwright <path to the playwright package>`);
    return false;
  }
  const b = await pw.chromium.launch();
  const p = await b.newPage({ viewport: { width: 1300, height: 800 }, deviceScaleFactor: 2 });
  await p.goto(pathToFileURL(html).href);
  await (await p.$(".card")).screenshot({ path: png });
  await b.close();
  return true;
}

const out = resolve(val("--out", "tracker.html"));
const png = val("--png", "");
do {
  const stages = readRun(runDir);
  writeFileSync(out, page(runDir, stages), "utf8");
  const live = stages.filter((s) => !s.isDone).length;
  console.log(`${basename(runDir)}: ${stages.length} stages, ${live} running -> ${out}`);
  if (png && (await screenshot(out, resolve(png)))) console.log(`screenshot -> ${resolve(png)}`);
  if (!flag("--watch") || !live) break;
  await sleep(5000);
} while (true);
