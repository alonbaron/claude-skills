#!/usr/bin/env node
// Stage tracker for a Workflow run (the build loop or any other), drawn as a feed: one card per
// subagent in run order, with a divider where the phase changes. A card shows its status (glyph and
// word), label, model alias and the id it resolved to, effort, and its result in one line; its fold
// says how long it ran with how many tools and tokens, and opens onto the full result, the stage's
// bar on the run's timeline and its numbers. Only running stages start open; a failed one says so in its header.
// Rendered from the run's own files under ~/.claude/projects/<project>/<session>/subagents/workflows/<run>/:
// journal.jsonl (stages and results), agent-<id>.meta.json (the alias asked for) and agent-<id>.jsonl
// (what actually ran). That layout is Claude Code internal; when it moves, this script says so instead of guessing.
//
//   node <plugin-root>/scripts/tracker.mjs                      newest run of the newest session, to ./tracker.html
//   node <plugin-root>/scripts/tracker.mjs --run <run dir>       that run
//   node <plugin-root>/scripts/tracker.mjs --session <id>        newest run of that session
//   node <plugin-root>/scripts/tracker.mjs --out <file.html>     where the page goes
//   node <plugin-root>/scripts/tracker.mjs --png <file.png>      also a screenshot (needs playwright with chromium;
//                                                                --playwright <path to its package> when not resolvable)
//   node <plugin-root>/scripts/tracker.mjs --watch               re-render every 5 s while the run goes on
// The workflow-watch mod (mods/workflow-watch) draws the same stages live inside Claude Code.

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
  // The comment block under the shebang, up to its first non-comment line.
  const src = readFileSync(new URL(import.meta.url)).toString().split(/\r?\n/);
  const end = src.findIndex((l, i) => i > 0 && !l.startsWith("//"));
  console.log(src.slice(1, end).map((l) => l.replace(/^\/\/ ?/, "")).join("\n"));
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
// m:ss with the minutes unpadded (0:46, 15:03).
const clock = (ms) => {
  if (ms == null || !Number.isFinite(ms)) return "-:--";
  const sec = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, "0")}`;
};
const kTok = (n) => `${(n / 1000).toFixed(1)}k`;
const many = (n, one, more) => `${n} ${n === 1 ? one : more}`;
function verdict(s) {
  if (!s.isDone) return "run";
  const r = s.result;
  if (r == null) return "empty";
  if (typeof r === "object" && (r.verdict === "fail" || r.ok === false || (Array.isArray(r.notFixed) && r.notFixed.length))) return "fail";
  return "ok";
}
const GLYPH = { run: "▶", ok: "✓", fail: "!", empty: "✗" };
const WORD = { run: "running", ok: "done", fail: "failed", empty: "no result" };
// "low" ... "max", and "n/a" for a model that records none; a stage whose turns ran at several levels gets each.
const effortClass = (e) => String(e).split(/,\s*/).map((x) => (x === "n/a" ? "na" : x.replace(/[^a-z]/gi, ""))).join(" ");
function fullResult(s) {
  if (!s.isDone) return "No result yet.";
  if (s.result == null) return "(no result)";
  return typeof s.result === "string" ? s.result : JSON.stringify(s.result, null, 2);
}
// The run directory as ~/.claude/projects/…/<session>/subagents/workflows/<run>: no home path, no project folder name.
function shortDir(dir) {
  const same = (a, b) => (process.platform === "win32" ? a.toLowerCase() === b.toLowerCase() : a === b);
  const home = resolve(homedir()).split(/[\\/]+/);
  let parts = resolve(dir).split(/[\\/]+/);
  if (home.length < parts.length && home.every((h, i) => same(h, parts[i]))) parts = ["~", ...parts.slice(home.length)];
  const p = parts.findIndex((x, i) => x === "projects" && parts[i - 1] === ".claude");
  if (p >= 0 && p + 1 < parts.length) parts = [...parts.slice(0, p + 1), "…", ...parts.slice(p + 2)];
  return parts.join("/");
}
function card(s, t0, total) {
  const v = verdict(s);
  const ran = s.start ? s.end - s.start : null;
  const from = s.start ? s.start - t0 : null;
  const left = s.start ? (from / total) * 100 : 0;
  const width = s.start ? Math.max(0.8, (ran / total) * 100) : 0;
  const line = v === "run" ? "no result yet" : summarize(s.label, s.result);
  const fold =
    v === "run"
      ? `Running for ${clock(ran)} · ${many(s.tools, "call", "calls")} · ${s.lastTool || "starting"}`
      : `Ran for ${clock(ran)} · ${many(s.tools, "tool", "tools")} · ${kTok(s.outTok)} tokens`;
  const span = s.start ? `+${clock(from)} to +${clock(from + ran)} of ${clock(total)}` : "not started";
  const num = (k, x) => `<div><dt>${esc(k)}</dt><dd>${esc(x)}</dd></div>`;
  const nums =
    num("started", s.start ? `+${clock(from)}` : "-") +
    num(v === "run" ? "running for" : "ran for", clock(ran)) +
    num("tool calls", s.tools) +
    num("output tokens", s.outTok.toLocaleString("en-US"));
  return `<article class="stage ${esc(v)}">
<div class="top"><span class="st"><span aria-hidden="true">${esc(GLYPH[v])}</span> ${esc(WORD[v])}</span><span class="lb">${esc(s.label)}</span></div>
<div class="who"><span class="m ${esc(s.alias)}">${esc(s.alias)}</span><span>→</span><span class="id">${esc(s.model)}</span><span class="ef ${esc(effortClass(s.effort))}">${esc(s.effort)}</span></div>
<p class="res">${esc(line.slice(0, 220))}</p>
<details${v === "run" ? " open" : ""}><summary>${esc(fold)}</summary><div class="more">
<div class="tl"><div class="track"><div class="fill" style="left:${esc(left.toFixed(1))}%;width:${esc(width.toFixed(1))}%"></div></div><span>${esc(span)}</span></div>
<dl class="nums">${nums}</dl>
<pre tabindex="0">${esc(fullResult(s))}</pre>
</div></details>
</article>`;
}
function page(dir, stages) {
  const t0 = Math.min(...stages.filter((s) => s.start).map((s) => s.start));
  const t1 = Math.max(...stages.map((s) => s.end ?? t0));
  const total = Math.max(1, t1 - t0);
  const live = stages.filter((s) => !s.isDone).length;
  const tokens = stages.reduce((n, s) => n + s.outTok, 0);
  // Run order, with a divider each time the phase changes (a second refute round gets its own).
  let prev = null;
  const feed = stages.map((s) => {
    const divider = s.phase !== prev ? `<h2 class="phase">${esc(s.phase || "(no phase)")}</h2>\n` : "";
    prev = s.phase;
    return divider + card(s, t0, total);
  });
  const state = `${live} running · ${stages.length - live} done · ${clock(total)} elapsed · ${kTok(tokens)} output tokens${live ? "" : " · finished"}`;
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${esc(basename(dir))}</title><style>
:root{--bg:#0f1115;--card:#161920;--line:#262b36;--fg:#e6e8ee;--dim:#8a93a6;--acc:#7aa2f7;--ok:#4fcf8a;--bad:#ff7b72;--warn:#f0c35b;--mono:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;--sans:system-ui,-apple-system,"Segoe UI",Roboto,sans-serif}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--fg);font:14px/1.5 var(--sans)}
main{max-width:808px;margin:0 auto;padding:24px;display:flex;flex-direction:column;gap:10px}
.head,.stage{background:var(--card);border:1px solid var(--line);border-radius:12px;padding:12px 16px}
.head h1{margin:0;font:600 16px/1.35 var(--mono);overflow-wrap:anywhere} .head p{margin:4px 0 0;color:var(--dim);font:12.5px/1.45 var(--mono)}
.phase{display:flex;align-items:center;gap:10px;margin:12px 0 2px;color:var(--acc);font:600 11.5px/1.2 var(--sans);letter-spacing:.06em;text-transform:uppercase}
.phase::before,.phase::after{content:"";flex:1 1 0;height:1px;background:var(--line)}
.stage{border-left:3px solid var(--ok)} .stage.run{border-left-color:var(--warn)} .stage.fail,.stage.empty{border-left-color:var(--bad)}
.top{display:flex;flex-wrap:wrap;align-items:baseline;gap:2px 12px} .st{font-size:12.5px;font-weight:600;white-space:nowrap}
.ok .st{color:var(--ok)} .run .st{color:var(--warn)} .fail .st,.empty .st{color:var(--bad)}
.lb{min-width:0;font:600 14px/1.4 var(--mono);overflow-wrap:anywhere}
.who{display:flex;flex-wrap:wrap;align-items:center;gap:4px 8px;margin-top:6px;color:var(--dim);font:12px/1.4 var(--mono)} .id{min-width:0;overflow-wrap:anywhere}
.m{font-size:11px;padding:1px 6px;border-radius:4px;background:#232838;color:var(--dim)} .m.fable{background:#3b2f6b;color:#d9ccff} .m.opus{background:#2d3f6b;color:#cfe0ff} .m.sonnet{background:#1f4a3a;color:#b9f0d2} .m.haiku{background:#4a3a1f;color:#f3dfae}
.ef{font-size:11px;padding:0 6px;border:1px solid var(--line);border-radius:4px;color:var(--dim)} .ef.na{border-style:dashed;font-style:italic}
.ef.medium{color:#c3cad8;border-color:#343a48} .ef.high{color:#d9ccff;border-color:#4b3f80} .ef.xhigh{color:#f3dfae;border-color:#6b5528} .ef.max{color:#ffb3ad;border-color:#7a3a36;font-weight:700}
.res{margin:8px 0 0;overflow-wrap:anywhere} .fail .res,.empty .res{color:#f3b5b0}
details{margin-top:8px;padding-top:6px;border-top:1px solid #1d212b}
summary{cursor:pointer;color:var(--dim);font:12px/1.5 var(--mono);overflow-wrap:anywhere} summary:hover{color:var(--fg)} summary:focus-visible{outline:2px solid var(--acc);outline-offset:2px;border-radius:4px}
.more{display:flex;flex-direction:column;gap:10px;margin-top:8px}
.track{position:relative;height:8px;overflow:hidden;background:#20242e;border-radius:4px} .fill{position:absolute;top:0;height:8px;border-radius:4px;background:#5b84d6} .run .fill{background:var(--warn)} .fail .fill,.empty .fill{background:var(--bad)}
.tl span{display:block;margin-top:4px;color:var(--dim);font:11.5px/1.4 var(--mono)}
.nums{display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:6px 16px;margin:0} .nums dt{color:var(--dim);font-size:11px;letter-spacing:.04em;text-transform:uppercase} .nums dd{margin:0;font:13px/1.4 var(--mono)}
pre{max-height:18em;overflow:auto;margin:0;padding:10px 12px;background:#11141a;border:1px solid #1d212b;border-radius:8px;color:#c9cfdb;font:12px/1.45 var(--mono);white-space:pre-wrap;overflow-wrap:anywhere}
.foot{padding:6px 2px 0;color:var(--dim);font-size:12px} .foot code{display:block;margin-bottom:2px;color:var(--fg);font:12px/1.45 var(--mono);overflow-wrap:anywhere}
@media (max-width:480px){main{padding:12px 10px}.head,.stage{padding:10px 12px}}
</style></head><body><main>
<header class="head"><h1>${esc(basename(dir))}</h1><p>${esc(state)}</p></header>
${feed.join("\n") || `<p class="res">No stages in this run yet.</p>`}
<footer class="foot"><code>${esc(shortDir(dir))}</code>tokens are the output tokens a stage generated, thinking included · each bar is the stage's start and length on the run's timeline · rendered ${esc(new Date().toISOString())}</footer>
</main></body></html>`;
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
  const p = await b.newPage({ viewport: { width: 900, height: 800 }, deviceScaleFactor: 2 });
  await p.goto(pathToFileURL(html).href);
  await (await p.$("main")).screenshot({ path: png });
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
