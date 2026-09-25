#!/usr/bin/env node
// Unattended driver for the alon-skills build loop: one fresh `claude -p` process per TODO task,
// each running the plugin workflow /alon-skills:build-loop for exactly one task, then exiting.
//
//   node <plugin-root>/scripts/autobuild.mjs --tasks 5            up to 5 tasks, one process each
//   node <plugin-root>/scripts/autobuild.mjs --task 2.1           that row only
//   node <plugin-root>/scripts/autobuild.mjs --dry-run            plumbing check: one session, no agents
//   node <plugin-root>/scripts/autobuild.mjs --repo <path>        repo to build (default: cwd)
//   node <plugin-root>/scripts/autobuild.mjs --config <path>      JSON merged into the workflow args
//                                                                 (default: <repo>/.claude/build-loop.json;
//                                                                 keys: models, maxFixRounds, skipLenses, scratch)
//   node <plugin-root>/scripts/autobuild.mjs --plugin-dir <path>  load the plugin from a checkout for the session
//                                                                 (when alon-skills is not installed)
//
// Stops when a session reports anything other than "reached maxTasks" (no eligible row, blocked, dirty tree),
// when claude exits non-zero, or when the result is a usage-limit or rate-limit error.
// Lock: <repo>/.claude/scratch/build-loop/.lock (pid + time; a lock whose pid is dead is stale and replaced).
// Log:  <repo>/.claude/scratch/build-loop/autobuild.log (UTF-8, appended).
// Progress: while a session runs, the newest workflow journal under ~/.claude/projects/<repo slug>/ is tailed
// and each stage is printed as it starts ("> Phase: label") and finishes ("< Phase: label -> summary").
// That journal layout is Claude Code internal and undocumented; if it is absent the driver stays silent
// and still reads the final JSON result.

import { spawn } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync, unlinkSync, appendFileSync } from "node:fs";
import { homedir } from "node:os";
import { join, resolve } from "node:path";
import { setTimeout as sleep } from "node:timers/promises";

// ---------- args ----------
const argv = process.argv.slice(2);
const flag = (name) => argv.includes(name);
const val = (name, dflt) => {
  const i = argv.indexOf(name);
  return i >= 0 && i + 1 < argv.length ? argv[i + 1] : dflt;
};
if (flag("--help") || flag("-h")) {
  console.log(readFileSync(new URL(import.meta.url)).toString().split("\n").slice(1, 21).map((l) => l.replace(/^\/\/ ?/, "")).join("\n"));
  process.exit(0);
}
const repo = resolve(val("--repo", process.cwd()));
const task = val("--task", "");
const dryRun = flag("--dry-run");
let tasks = Number(val("--tasks", "5"));
if (!Number.isInteger(tasks) || tasks < 1) tasks = 5;
if (task) tasks = 1;
const configPath = resolve(val("--config", join(repo, ".claude", "build-loop.json")));
const pluginDir = val("--plugin-dir", "");

if (!existsSync(join(repo, ".git"))) {
  console.error(`not a git repo: ${repo}`);
  process.exit(2);
}
let config = {};
if (existsSync(configPath)) {
  try {
    config = JSON.parse(readFileSync(configPath, "utf8"));
  } catch (e) {
    console.error(`config ${configPath} is not valid JSON: ${e.message}`);
    process.exit(2);
  }
}

// ---------- log + lock ----------
const stateDir = join(repo, ".claude", "scratch", "build-loop");
mkdirSync(stateDir, { recursive: true });
const logPath = join(stateDir, "autobuild.log");
const lockPath = join(stateDir, ".lock");
// Commits are the repo owner's alone. Claude Code adds a Co-Authored-By trailer by default, and a
// Claude-Session trailer in web and Remote Control sessions; a prompt rule alone did not stop either
// (measured 2026-09-24: 3/3 commits carried both by default, 0/3 with this file).
const settingsPath = join(stateDir, "session-settings.json");
writeFileSync(settingsPath, JSON.stringify({ attribution: { commit: "", pr: "", sessionUrl: false } }), "utf8");
const stamp = () => {
  const d = new Date();
  const two = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${two(d.getMonth() + 1)}-${two(d.getDate())} ${two(d.getHours())}:${two(d.getMinutes())}`;
};
function say(text) {
  const line = `[${stamp()}] ${text}`;
  console.log(line);
  appendFileSync(logPath, line + "\n", "utf8");
}
function raw(text) {
  appendFileSync(logPath, text + "\n", "utf8");
}
function pidAlive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch (e) {
    return e.code === "EPERM";
  }
}
if (existsSync(lockPath)) {
  let other = null;
  try {
    other = JSON.parse(readFileSync(lockPath, "utf8"));
  } catch {}
  if (other && Number.isInteger(other.pid) && pidAlive(other.pid)) {
    console.error(`another autobuild (pid ${other.pid}, started ${other.time}) holds ${lockPath}; not starting a second one on the same tree`);
    process.exit(3);
  }
  say(`stale lock from pid ${other ? other.pid : "?"} replaced`);
  try {
    unlinkSync(lockPath);
  } catch {}
}
try {
  // "wx" fails if the file exists, so two drivers started together cannot both take the lock.
  writeFileSync(lockPath, JSON.stringify({ pid: process.pid, time: new Date().toISOString(), repo }), { encoding: "utf8", flag: "wx" });
} catch (e) {
  console.error(`could not take ${lockPath} (${e.code}); another autobuild may be starting on the same tree`);
  process.exit(3);
}
const releaseLock = () => {
  try {
    unlinkSync(lockPath);
  } catch {}
};
process.on("exit", releaseLock);
let current = null; // the running claude child, stopped with the driver so the lock never outlives it
for (const sig of ["SIGINT", "SIGTERM"])
  process.on(sig, () => {
    if (current) current.kill(sig);
    process.exit(130);
  });

// ---------- progress: tail the newest workflow journal for this repo ----------
const slugOf = (p) => p.replace(/[^A-Za-z0-9]/g, "-");
const projectsDir = join(homedir(), ".claude", "projects");
function projectDirs() {
  // The slug lowercases nothing by rule, but observed dirs lowercase the Windows drive letter; match case-insensitively.
  const want = slugOf(repo).toLowerCase();
  try {
    return readdirSync(projectsDir)
      .filter((d) => d.toLowerCase() === want)
      .map((d) => join(projectsDir, d));
  } catch {
    return [];
  }
}
function newestJournal(since) {
  let best = null;
  for (const proj of projectDirs()) {
    let sessions = [];
    try {
      sessions = readdirSync(proj, { withFileTypes: true }).filter((d) => d.isDirectory());
    } catch {
      continue;
    }
    for (const s of sessions) {
      const wfDir = join(proj, s.name, "subagents", "workflows");
      let runs = [];
      try {
        runs = readdirSync(wfDir);
      } catch {
        continue;
      }
      for (const r of runs) {
        const j = join(wfDir, r, "journal.jsonl");
        try {
          const st = statSync(j);
          if (st.mtimeMs >= since && (!best || st.mtimeMs > best.mtime)) best = { path: j, mtime: st.mtimeMs };
        } catch {}
      }
    }
  }
  return best ? best.path : null;
}
const count = (a) => (Array.isArray(a) ? a.length : 0);
function summarize(label, r) {
  const role = String(label).split(":")[0];
  if (!r || typeof r !== "object") return "(no result)";
  switch (role) {
    case "plan":
      if (r.staleBlocked) return `stale row ${r.staleBlocked.taskId}: ${r.staleBlocked.reason}`;
      return r.taskId ? `picked ${r.taskId} on ${r.branch}${r.resuming ? " (resuming)" : ""}; carried notes: ${count(r.leftForThisTask)}` : `stop: ${r.stopReason}`;
    case "scout":
      return `${count(r.files)} files, ${count(r.tests)} tests, ${count(r.docSections)} doc sections`;
    case "spec":
      return r.stopReason ? `stop: ${r.stopReason}` : `spec at ${r.specPath}; docs changed: ${count(r.docsChanged) ? r.docsChanged.join(", ") : "none"}; unverified APIs: ${count(r.unverifiedApis)}`;
    case "research":
      return `research at ${r.researchPath}; still unverified: ${count(r.unverifiedRemaining)}`;
    case "build": {
      const lines = [`ok=${r.ok} commits=${count(r.commits)} tests=${r.testsPassed ? "pass" : "FAIL"} lint=${r.lintPassed ? "pass" : "FAIL"} deviations=${count(r.deviations)}`];
      for (const c of r.commits || []) lines.push(`      ${c}`);
      for (const d of r.deviations || []) lines.push(`      deviation: ${d}`);
      if (r.blockedReason) lines.push(`      BLOCKED: ${r.blockedReason}`);
      return lines.join("\n");
    }
    case "measure":
      return `${r.filesChanged} files, ${r.linesChanged} lines${r.docsOnly ? ", docs only" : ""}${r.touchesTrustBoundary ? ", trust boundary" : ""}`;
    case "refute": {
      const lines = [`${String(r.verdict).toUpperCase()} blocking=${count(r.blocking)} advisory=${count(r.advisory)} testsRan=${r.testsRan}`];
      for (const f of r.blocking || []) lines.push(`      BLOCK ${f.file}:${f.line ?? "-"} ${f.issue}`);
      for (const f of r.advisory || []) lines.push(`      note  ${f.file}:${f.line ?? "-"} ${f.issue}`);
      return lines.join("\n");
    }
    case "arbiter":
      return (r.rulings || []).map((x) => `${x.key} ${x.ruling}: ${x.reason}`).join("; ") || "no rulings";
    case "fix": {
      const lines = [`fixed=${count(r.fixed)} disputed=${count(r.notFixed)} commits=${count(r.commits)}`];
      for (const x of r.notFixed || []) lines.push(`      disputed: ${x.key}: ${x.reason}`);
      return lines.join("\n");
    }
    case "close":
      return r.ok ? `row updated, commit ${r.commit || "?"}` : "close reported not ok";
    default:
      return JSON.stringify(r).slice(0, 200);
  }
}
function makeProgress(since) {
  let printed = 0;
  let journal = null;
  const names = new Map();
  return () => {
    if (!journal) {
      journal = newestJournal(since);
      if (!journal) return;
    }
    let lines;
    try {
      lines = readFileSync(journal, "utf8").split("\n").filter(Boolean);
    } catch {
      return;
    }
    for (let k = 0; k < lines.length; k++) {
      let e;
      try {
        e = JSON.parse(lines[k]);
      } catch {
        if (k === lines.length - 1) {
          lines.length = k; // half-flushed last line: read it again on the next tick
          break;
        }
        continue;
      }
      if (e.type === "started" && e.key) names.set(e.key, { label: e.label, phase: e.phase });
      if (k < printed) continue;
      if (e.type === "started" && e.label) say(`  > ${e.phase}: ${e.label}`);
      else if (e.type === "result" && names.has(e.key)) {
        const n = names.get(e.key);
        say(`  < ${n.phase}: ${n.label} -> ${summarize(n.label, e.result)}`);
      }
    }
    printed = lines.length;
  };
}

// ---------- one headless session ----------
function runSession(wfArgs) {
  return new Promise((done) => {
    const prompt = `Use the Workflow tool with name alon-skills:build-loop and args ${JSON.stringify(wfArgs)}. Wait for it to finish. Reply with only the JSON object it returned, no prose.`;
    const cliArgs = ["-p", "--model", "fable", "--permission-mode", "auto", "--allowedTools", "Workflow", "--output-format", "json"];
    const quote = (p) => (process.platform === "win32" ? JSON.stringify(p) : p);
    cliArgs.push("--settings", quote(settingsPath));
    if (pluginDir) cliArgs.push("--plugin-dir", quote(resolve(pluginDir)));
    const env = { ...process.env, CLAUDE_CODE_PRINT_BG_WAIT_CEILING_MS: process.env.CLAUDE_CODE_PRINT_BG_WAIT_CEILING_MS || "7200000" };
    // On Windows `claude` is a .cmd shim, which Node only runs through a shell; one command string avoids
    // the args-with-shell deprecation. Every arg is a plain token or JSON-quoted there; elsewhere no shell, no quotes.
    const child =
      process.platform === "win32"
        ? spawn(`claude ${cliArgs.join(" ")}`, { cwd: repo, env, shell: true, stdio: ["pipe", "pipe", "pipe"] })
        : spawn("claude", cliArgs, { cwd: repo, env, stdio: ["pipe", "pipe", "pipe"] });
    current = child;
    let out = "";
    let err = "";
    child.stdout.on("data", (d) => (out += d));
    child.stderr.on("data", (d) => (err += d));
    child.on("error", (e) => done({ code: -1, out, err: `${err}\nspawn failed: ${e.message}` }));
    child.on("close", (code) => {
      current = null;
      done({ code, out, err });
    });
    child.stdin.end(prompt, "utf8"); // prompt via stdin: no shell quoting of JSON on any platform
  });
}
function parseResult(out) {
  let doc = null;
  try {
    doc = JSON.parse(out);
  } catch {
    // stream noise before the JSON document: take the last top-level object
    const m = out.match(/\{[\s\S]*\}\s*$/);
    if (m) {
      try {
        doc = JSON.parse(m[0]);
      } catch {}
    }
  }
  if (!doc) return { doc: null, stopped: null };
  const text = typeof doc.result === "string" ? doc.result : "";
  let stopped = null;
  const inner = text.match(/\{[\s\S]*\}/);
  if (inner) {
    try {
      stopped = JSON.parse(inner[0]).stoppedBecause ?? null;
    } catch {}
  }
  return { doc, stopped };
}
// A reply that carries stoppedBecause finished normally, and its text holds task rows and commit hashes that
// can contain "rate limit" or "429"; only a reply without one is checked against the limit messages.
const usageLimited = (doc, text, stopped) =>
  Boolean(doc && doc.api_error_status === 429) ||
  (!stopped && /you've hit your (session|usage) limit|usage limit reached|rate limit|\b429\b/i.test(text || ""));

// ---------- main ----------
let branch = "?";
try {
  branch = readFileSync(join(repo, ".git", "HEAD"), "utf8").trim().replace(/^ref: refs\/heads\//, "");
} catch {}
say(`autobuild in ${repo} (branch ${branch}): ${dryRun ? "dry run" : task ? `task ${task}` : `up to ${tasks} task(s)`}${Object.keys(config).length ? `, config ${configPath}` : ""}`);

let exitCode = 0;
for (let i = 1; i <= tasks; i++) {
  const wfArgs = dryRun ? { ...config, dryRun: true } : task ? { ...config, task, maxTasks: 1 } : { ...config, maxTasks: 1 };
  say(`session ${i}/${tasks} starting`);
  const since = Date.now() - 2000;
  const tick = makeProgress(since);
  const timer = setInterval(tick, 15000);
  const r = await runSession(wfArgs);
  clearInterval(timer);
  await sleep(500);
  tick();

  const { doc, stopped } = parseResult(r.out);
  if (r.code !== 0) {
    say(`claude exited ${r.code}; stopping`);
    raw(r.out.trim());
    raw(r.err.trim());
    exitCode = 1;
    break;
  }
  if (!doc) {
    say("no JSON result from claude; stopping");
    raw(r.out.trim());
    exitCode = 1;
    break;
  }
  say(`session ${doc.session_id || "?"} cost $${Number(doc.total_cost_usd || 0).toFixed(2)} turns ${doc.num_turns ?? "?"}`);
  raw(typeof doc.result === "string" ? doc.result.trim() : JSON.stringify(doc));
  if (usageLimited(doc, doc.result, stopped)) {
    say(`usage or rate limit hit: ${String(doc.result || "").slice(0, 160)}; stopping`);
    exitCode = 1;
    break;
  }
  if (!stopped) {
    say("no stoppedBecause in the reply; stopping");
    exitCode = 1;
    break;
  }
  say(`session ${i} done: ${stopped}`);
  if (!/^reached maxTasks/.test(stopped)) {
    say(`loop ended: ${stopped}`);
    break;
  }
}
say(`autobuild finished; see docs/handoff.md and ${logPath}`);
process.exit(exitCode);
