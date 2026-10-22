#!/usr/bin/env node
// Session & Workflow tracker for Claude Code (CLI & VS Code extension) and Antigravity (VS Code extension / IDE),
// drawn as a timeline waterfall + activity feed: tracks full sessions (main-thread turns, skills fired,
// spawned subagents, git commits) AND Workflow runs (build-loop stages). Each card shows its status
// (glyph and word), kind badge, label, always-visible metric pills (duration, tools, output tokens),
// model alias -> resolved id, effort, user prompt (for turns), and one-line result; its fold opens onto
// the timeline span, tool call trail, and full output. Only running items start open; failed ones stand out in red.
// Rendered from ~/.claude/projects/<project>/<session>.jsonl (+ subagents/ and workflows/<run>/journal.jsonl)
// or ~/.gemini/antigravity/brain/<conversation-id>/.system_generated/logs/transcript.jsonl.
//
//   node <plugin-root>/scripts/tracker.mjs                        newest Claude Code or Antigravity session/run, to ./tracker.html
//   node <plugin-root>/scripts/tracker.mjs --session <id>          that session (Claude Code or Antigravity)
//   node <plugin-root>/scripts/tracker.mjs --source <auto|claude|antigravity>  filter by extension source (default: auto)
//   node <plugin-root>/scripts/tracker.mjs --run <dir-or-jsonl>    that specific workflow run directory or transcript .jsonl
//   node <plugin-root>/scripts/tracker.mjs --out <file.html>       where the page goes
//   node <plugin-root>/scripts/tracker.mjs --png <file.png>        also a screenshot (needs playwright with chromium;
//                                                                  --playwright <path to its package> when not resolvable)
//   node <plugin-root>/scripts/tracker.mjs --watch                 re-render every 5 s (with live browser auto-refresh)
// Inside Claude Code (CLI or VS Code extension), mods/workflow-watch draws the same feed live (/tracker or /workflow-watch).

import { existsSync, openSync, readFileSync, readSync, closeSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
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

// ---------- locate target (Claude Code or Antigravity session / workflow run) ----------
const VALID_ID = /^[a-zA-Z0-9_-]+$/;

function safeList(p) {
  try {
    return readdirSync(p);
  } catch {
    return [];
  }
}
function safeMtime(p) {
  try {
    return statSync(p).mtimeMs;
  } catch {
    return 0;
  }
}
function safeJson(p) {
  try {
    return JSON.parse(readFileSync(p, "utf8"));
  } catch {
    return null;
  }
}
function isTopLevelAntigravityTranscript(p) {
  try {
    const fd = openSync(p, "r");
    const buf = Buffer.alloc(512);
    const bytes = readSync(fd, buf, 0, 512, 0);
    closeSync(fd);
    const firstLine = buf.subarray(0, bytes).toString("utf8").split(/\r?\n/)[0] || "";
    return firstLine.includes('"USER_INPUT"') || firstLine.includes('"USER_EXPLICIT"');
  } catch {
    return false;
  }
}

function findTarget(runArg, sessionArg, sourceArg = "auto") {
  const srcMode = String(sourceArg || "auto").toLowerCase();
  const allowClaude = srcMode === "auto" || srcMode === "claude";
  const allowAgy = srcMode === "auto" || srcMode === "antigravity" || srcMode === "agy";

  if (runArg) {
    const r = resolve(runArg);
    if (existsSync(join(r, "journal.jsonl"))) {
      return { source: "claude", mode: "workflow", id: basename(r), dir: r, sessionFile: null, subagentsDir: null, wfDir: r };
    }
    const agyInDir = join(r, ".system_generated", "logs", "transcript.jsonl");
    if (existsSync(agyInDir)) {
      return { source: "antigravity", mode: "session", id: basename(r), dir: agyInDir, sessionFile: agyInDir, subagentsDir: dirname(r), wfDir: null };
    }
    if (r.endsWith("transcript.jsonl") && existsSync(r)) {
      const cid = basename( resolve(r, "..", "..", "..") );
      const brainDir = resolve(r, "..", "..", "..", "..");
      return { source: "antigravity", mode: "session", id: cid, dir: r, sessionFile: r, subagentsDir: brainDir, wfDir: null };
    }
    const sf = r.endsWith(".jsonl") ? r : `${r}.jsonl`;
    if (existsSync(sf)) {
      const sid = basename(sf, ".jsonl");
      const sub = join(dirname(sf), sid, "subagents");
      return { source: "claude", mode: "session", id: sid, dir: sf, sessionFile: sf, subagentsDir: existsSync(sub) ? sub : null, wfDir: newestWfIn(sub) };
    }
    const projects = join(homedir(), ".claude", "projects");
    for (const proj of safeList(projects)) {
      const projDir = join(projects, proj);
      for (const sess of safeList(projDir)) {
        if (sess.endsWith(".jsonl")) continue;
        const sub = join(projDir, sess, "subagents");
        for (const w of safeList(sub)) {
          if (w === runArg || w.startsWith(runArg)) {
            const wfDir = join(sub, w);
            if (existsSync(join(wfDir, "journal.jsonl"))) {
              return { source: "claude", mode: "workflow", id: w, dir: wfDir, sessionFile: null, subagentsDir: sub, wfDir };
            }
          }
        }
      }
    }
    return null;
  }

  let best = null;

  if (allowClaude) {
    const projects = join(homedir(), ".claude", "projects");
    for (const proj of safeList(projects)) {
      const projDir = join(projects, proj);
      const entries = safeList(projDir);

      // Check <session>.jsonl files in project directory
      for (const f of entries) {
        if (!f.endsWith(".jsonl")) continue;
        const sid = f.slice(0, -".jsonl".length);
        if (sessionArg && sid !== sessionArg && !sid.startsWith(sessionArg)) continue;
        const sessionFile = join(projDir, f);
        const sub = join(projDir, sid, "subagents");
        const wfDir = newestWfIn(sub);
        const mtime = Math.max(safeMtime(sessionFile), wfDir ? safeMtime(join(wfDir, "journal.jsonl")) : 0);
        if (mtime > 0 && (!best || mtime > best.mtime)) {
          best = {
            source: "claude",
            mode: "session",
            id: sid,
            dir: sessionFile,
            sessionFile,
            subagentsDir: existsSync(sub) ? sub : null,
            wfDir,
            mtime,
          };
        }
      }

      // Also check session directories that only have a workflow run (no <session>.jsonl)
      for (const sess of entries) {
        if (sess.endsWith(".jsonl")) continue;
        if (sessionArg && sess !== sessionArg && !sess.startsWith(sessionArg)) continue;
        const sub = join(projDir, sess, "subagents");
        const wfDir = newestWfIn(sub);
        if (!wfDir) continue;
        const sessionFile = join(projDir, `${sess}.jsonl`);
        if (existsSync(sessionFile)) continue;
        const mtime = safeMtime(join(wfDir, "journal.jsonl"));
        if (mtime > 0 && (!best || mtime > best.mtime)) {
          best = {
            source: "claude",
            mode: "workflow",
            id: basename(wfDir),
            dir: wfDir,
            sessionFile: null,
            subagentsDir: sub,
            wfDir,
            mtime,
          };
        }
      }
    }
  }

  if (allowAgy) {
    const agyBrain = join(homedir(), ".gemini", "antigravity", "brain");
    for (const cid of safeList(agyBrain)) {
      if (cid === "tempmediaStorage") continue;
      if (sessionArg && cid !== sessionArg && !cid.startsWith(sessionArg)) continue;
      const tf = join(agyBrain, cid, ".system_generated", "logs", "transcript.jsonl");
      if (!existsSync(tf)) continue;
      if (!sessionArg && !isTopLevelAntigravityTranscript(tf)) continue;
      const mtime = safeMtime(tf);
      if (mtime > 0 && (!best || mtime > best.mtime)) {
        best = {
          source: "antigravity",
          mode: "session",
          id: cid,
          dir: tf,
          sessionFile: tf,
          subagentsDir: agyBrain,
          wfDir: null,
          mtime,
        };
      }
    }
  }

  return best;
}

function newestWfIn(subagentsDir) {
  if (!subagentsDir) return null;
  const wfRoot = join(subagentsDir, "workflows");
  let best = null;
  for (const run of safeList(wfRoot)) {
    const j = join(wfRoot, run, "journal.jsonl");
    const m = safeMtime(j);
    if (m > 0 && (!best || m > best.mtime)) best = { dir: join(wfRoot, run), mtime: m };
  }
  return best ? best.dir : null;
}

const target = findTarget(val("--run", ""), val("--session", ""), val("--source", "auto"));
if (!target) {
  const hint = val("--run", "") || val("--session", "");
  console.error(
    hint
      ? `no session or workflow run found for ${hint}`
      : "no session or workflow run found under ~/.claude/projects or ~/.gemini/antigravity/brain",
  );
  process.exit(2);
}

// ---------- read & parse ----------
// Antigravity writes a compact transcript.jsonl (long fields truncated) and an untruncated transcript_full.jsonl beside it.
const fullTranscript = (p) => {
  if (!/[\\/]transcript\.jsonl$/.test(p)) return p;
  const full = p.replace(/transcript\.jsonl$/, "transcript_full.jsonl");
  return existsSync(full) ? full : p;
};
const jsonLines = (p) =>
  existsSync(p)
    ? readFileSync(fullTranscript(p), "utf8")
        .split("\n")
        .filter(Boolean)
        .flatMap((l) => {
          try {
            return [JSON.parse(l)];
          } catch {
            return [];
          }
        })
    : [];

const count = (a) => (Array.isArray(a) ? a.length : 0);
// One line (each run of whitespace and control characters becomes one space), at most n characters; a cut ends in "…".
const oneLine = (v) => String(v ?? "").replace(/[\s\u0000-\u001f\u007f-\u009f]+/g, " ").trim();
const clip = (t, n) => (t.length <= n ? t : n <= 0 ? "" : `${t.slice(0, n - 1)}…`);
const str = (v, n = 90) => clip(oneLine(v), n);

function unquoteArg(v) {
  if (typeof v !== "string") return "";
  const s = v.trim();
  if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("[") && s.endsWith("]")) || (s.startsWith("{") && s.endsWith("}"))) {
    try {
      const parsed = JSON.parse(s);
      if (typeof parsed === "string") return parsed;
    } catch {}
  }
  // A JSON-quoted value cut short by transcript truncation: drop the opening quote and undo the escapes.
  if (s.startsWith('"')) return s.slice(1).replace(/\\n/g, "\n").replace(/\\"/g, '"').replace(/\\\\/g, "\\");
  return s;
}

function inferAlias(model) {
  if (!model) return "?";
  const m = String(model).toLowerCase();
  if (m.includes("fable")) return "fable";
  if (m.includes("opus")) return "opus";
  if (m.includes("sonnet")) return "sonnet";
  if (m.includes("haiku")) return "haiku";
  if (m.includes("gemini") || m.includes("argon")) return "gemini";
  return "?";
}

function summarize(label, r) {
  const role = String(label).split(":")[0];
  if (typeof r === "string") return str(r, 140);
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
      return b.length ? `${head} | ${str(b[0].file)}: ${str(b[0].issue, 110)}` : head;
    }
    case "arbiter":
      return (r.rulings || []).map((x) => `${x.key} ${x.ruling}: ${str(x.reason, 100)}`).join("; ") || "no rulings";
    case "fix":
      return `fixed=${count(r.fixed)} disputed=${count(r.notFixed)} commits=${count(r.commits)}` + (r.notFixed || []).map((x) => ` | disputed ${x.key}: ${str(x.reason, 100)}`).join("");
    case "close":
      return r.ok ? `row updated, commit ${r.commit || "?"}` : "close reported not ok";
    default:
      return str(JSON.stringify(r), 140);
  }
}

function readAgentTranscript(f) {
  let first = null,
    last = null,
    tools = 0,
    lastTool = "",
    outTok = 0,
    handback = null,
    lastText = null;
  const models = new Set(),
    efforts = new Set(),
    seenMsgTokens = new Map(),
    toolTrail = [];
  if (existsSync(f)) {
    for (const e of jsonLines(f)) {
      const rawTs = e.timestamp || e.created_at;
      if (rawTs) {
        const t = Date.parse(rawTs);
        if (Number.isFinite(t)) {
          first = first ?? t;
          last = t;
        }
      }
      if (e.type === "PLANNER_RESPONSE") {
        outTok += e.output_tokens || 0;
        if (typeof e.content === "string" && oneLine(e.content)) lastText = e.content.trim();
        for (const tc of Array.isArray(e.tool_calls) ? e.tool_calls : []) {
          const name = oneLine(tc.name || "?");
          const args = tc.args || {};
          if (name === "send_message") {
            const msgText = unquoteArg(args.Message).trim();
            if (msgText) handback = msgText;
            continue;
          }
          tools += 1;
          const arg = str([args.CommandLine, args.AbsolutePath, args.TargetFile, args.query, args.Url, args.toolSummary].map(unquoteArg).find(Boolean) || "", 56);
          lastTool = `${name}${arg ? ` ${arg}` : ""}`;
          if (toolTrail.length < 14) toolTrail.push(lastTool);
        }
        continue;
      }
      const msg = e.message || {};
      if (e.type === "assistant") {
        // `<synthetic>` is the client's own message when a call fails, not a model.
        if (msg.model && msg.model !== "<synthetic>") models.add(oneLine(msg.model));
        if (e.effort) efforts.add(oneLine(e.effort));
        const uTok = msg.usage?.output_tokens || 0;
        if (typeof msg.id === "string") {
          const prevTok = seenMsgTokens.get(msg.id) || 0;
          if (uTok > prevTok) {
            outTok += uTok - prevTok;
            seenMsgTokens.set(msg.id, uTok);
          }
        } else {
          outTok += uTok;
        }
      }
      for (const b of Array.isArray(msg.content) ? msg.content : []) {
        if (b.type === "text" && typeof b.text === "string" && oneLine(b.text)) {
          lastText = b.text.trim();
        }
        if (b.type === "tool_use") {
          const i = b.input || {};
          const name = oneLine(b.name || "?");
          if (name === "SubagentHandback") {
            if (typeof i.message === "string" && i.message.trim()) handback = i.message.trim();
            continue;
          }
          tools += 1;
          const arg = str(i.command || i.file_path || i.pattern || i.description || i.skill || "", 56);
          lastTool = `${name}${arg ? ` ${arg}` : ""}`;
          if (toolTrail.length < 14) toolTrail.push(lastTool);
        }
      }
    }
  }
  return {
    first,
    last,
    tools,
    lastTool,
    toolTrail,
    outTok,
    model: [...models].join(", ") || "?",
    effort: [...efforts].join(", ") || "n/a",
    handback,
    lastText,
  };
}

function readWorkflowRun(dir) {
  if (!dir || !existsSync(join(dir, "journal.jsonl"))) return [];
  const stages = [];
  const byKey = new Map();
  // A stage's first terminal entry (result or failed) wins, as in the mod.
  for (const e of jsonLines(join(dir, "journal.jsonl"))) {
    if (e.type === "started" && e.key) {
      const s = { kind: "stage", key: e.key, agentId: e.agentId ? oneLine(e.agentId) : null, label: oneLine(e.label), phase: oneLine(e.phase), result: undefined, isDone: false };
      stages.push(s);
      byKey.set(e.key, s);
    } else if (e.type === "result" && byKey.has(e.key) && !byKey.get(e.key).isDone) {
      Object.assign(byKey.get(e.key), { result: e.result, isDone: true });
    } else if (e.type === "failed" && byKey.has(e.key) && !byKey.get(e.key).isDone) {
      // The stage died before it returned (a session limit, an API error): finished, with no result.
      Object.assign(byKey.get(e.key), { isDone: true, died: true });
    }
  }
  for (const s of stages) {
    const validAgent = s.agentId && VALID_ID.test(s.agentId);
    const metaDoc = validAgent ? safeJson(join(dir, `agent-${s.agentId}.meta.json`)) : null;
    s.alias = metaDoc?.model ? oneLine(metaDoc.model) : "?";
    const info = validAgent ? readAgentTranscript(join(dir, `agent-${s.agentId}.jsonl`)) : readAgentTranscript("");
    if (s.alias === "?" && info.model !== "?") s.alias = inferAlias(info.model);
    Object.assign(s, {
      start: info.first,
      end: s.isDone ? info.last : Date.now(),
      tools: info.tools,
      lastTool: info.lastTool,
      toolTrail: info.toolTrail,
      outTok: info.outTok,
      model: info.model,
      effort: info.effort,
    });
  }
  return stages;
}

const toolResultText = (content) =>
  typeof content === "string"
    ? content
    : Array.isArray(content)
      ? content.map((b) => (b && typeof b.text === "string" ? b.text : "")).join("\n")
      : "";

function cleanPrompt(content) {
  if (Array.isArray(content) && content.every((b) => b && b.type === "tool_result")) return null;
  const raw =
    typeof content === "string"
      ? content
      : Array.isArray(content)
        ? content
            .filter((b) => b && b.type === "text")
            .map((b) => b.text || "")
            .join(" ")
        : "";
  const stripped = raw
    .replace(/<browser_instruction>[\s\S]*?<\/browser_instruction>/gi, "")
    .replace(/<system-reminder>[\s\S]*?<\/system-reminder>/gi, "")
    .trim();
  if (!stripped || /^<(task-notification|command-name|local-command-|agent-message)/i.test(stripped)) return null;
  return oneLine(stripped) || null;
}

function readSession(sessionFile, subagentsDir) {
  if (!sessionFile || !existsSync(sessionFile)) return [];
  const items = [];
  const pendingAgents = new Map();
  const agentsById = new Map();
  const pendingCommits = new Map();
  const seenCommits = new Set();
  const seenMsgTokens = new Map();
  let turnCount = 0;
  let currentTurn = null;
  let turnModels = new Set();
  let turnEfforts = new Set();
  let currentPhase = "Session";
  let lastTurnAt = Date.now();

  let agyModel = "?";
  let agyEffort = "n/a";
  let agyAlias = "?";
  const pendingAgyAgents = [];
  // Set by invoke_subagent; only the next "Created the following subagents" result is a real spawn (not a tool output quoting it).
  let awaitingSubagents = false;
  const pendingAgyCommits = [];
  const seenTurnSkills = new Set();

  const openTurn = (t, prompt) => {
    turnCount += 1;
    currentPhase = `Turn ${turnCount}`;
    lastTurnAt = t;
    turnModels = new Set();
    turnEfforts = new Set();
    const turn = {
      kind: "turn",
      key: `turn:${turnCount}`,
      label: `turn:${turnCount}`,
      phase: currentPhase,
      prompt: prompt || null,
      alias: "?",
      model: "?",
      effort: "n/a",
      start: t,
      end: null,
      isDone: false,
      tools: 0,
      lastTool: "",
      toolTrail: [],
      outTok: 0,
      summary: prompt ? str(prompt, 140) : "",
      result: prompt || "",
    };
    items.push(turn);
    return turn;
  };

  const recordCommit = (id, pc, out, t, toolPrefix = "Bash") => {
    if (/nothing to commit/i.test(out)) return;
    const std = /\[([^\s\]]+)\s+([0-9a-f]{7,12})\]\s*([^\r\n]+)/.exec(out);
    const mFlag = /\bgit\s+(?:-C\s+\S+\s+)?commit\b[^;&|]*?-m\s+(?:"([^"]+)"|'([^']+)')/.exec(pc.cmd);
    const subject = oneLine(std?.[3] ?? mFlag?.[1] ?? mFlag?.[2] ?? "git commit");
    const cleanOut = out.replace(/\u001b\[[0-9;]*m/g, "");
    const shaLine = subject
      ? cleanOut
          .split(/\r?\n/)
          .map((l) => /^([0-9a-f]{7,12})\s+(.+)/.exec(l))
          .find((m) => m && m[2]?.includes(subject.slice(0, 20)))
      : null;
    const sha = std?.[2] ?? shaLine?.[1] ?? null;
    const dedupKey = sha ?? subject;
    if (seenCommits.has(dedupKey)) return;
    seenCommits.add(dedupKey);
    items.push({
      kind: "commit",
      key: `commit:${id}`,
      label: sha ? `commit:${sha}` : "commit",
      phase: pc.phase,
      alias: pc.alias || "?",
      model: pc.model || "?",
      effort: pc.effort || "n/a",
      start: pc.at,
      end: t,
      isDone: true,
      tools: 1,
      lastTool: `${toolPrefix} git commit`,
      toolTrail: [`${toolPrefix} ${str(pc.cmd, 70)}`],
      outTok: 0,
      summary: str(subject, 140),
      result: cleanOut || pc.cmd,
    });
  };

  // Map toolUseId -> { agentId, model } from subagents/agent-*.meta.json
  const metaByToolUse = new Map();
  if (subagentsDir && existsSync(subagentsDir)) {
    for (const f of safeList(subagentsDir)) {
      if (!f.startsWith("agent-") || !f.endsWith(".meta.json")) continue;
      const aid = f.slice("agent-".length, -".meta.json".length);
      if (!VALID_ID.test(aid)) continue;
      const m = safeJson(join(subagentsDir, f));
      if (m?.toolUseId) metaByToolUse.set(oneLine(m.toolUseId), { agentId: aid, model: m.model ? oneLine(m.model) : null });
    }
  }

  for (const e of jsonLines(sessionFile)) {
    const rawTs = e.timestamp || e.created_at;
    const at = rawTs ? Date.parse(rawTs) : NaN;
    const t = Number.isFinite(at) ? at : lastTurnAt;
    const msg = e.message || {};

    if (e.type === "USER_INPUT") {
      const rawContent = typeof e.content === "string" ? e.content : "";
      const modelMatch = /Model Selection[^\r\n]*? to ([^\r\n.]+)/i.exec(rawContent)?.[1];
      if (modelMatch) {
        const me = /^(.+?)\s*\((Low|Medium|High|Max)\)$/i.exec(modelMatch.trim());
        agyModel = oneLine(me ? me[1] : modelMatch);
        if (me?.[2]) agyEffort = oneLine(me[2].toLowerCase());
        agyAlias = inferAlias(agyModel);
      }
      const reqMatch = /<USER_REQUEST>([\s\S]*?)<\/USER_REQUEST>/i.exec(rawContent)?.[1];
      const prompt = oneLine(reqMatch ?? rawContent.replace(/<(ADDITIONAL_METADATA|USER_SETTINGS_CHANGE)>[\s\S]*?<\/\1>/gi, ""));
      if (prompt) {
        if (currentTurn && !currentTurn.isDone) {
          currentTurn.isDone = true;
          currentTurn.end = lastTurnAt;
        }
        seenTurnSkills.clear();
        currentTurn = openTurn(t, prompt);
        currentTurn.model = agyModel !== "?" ? agyModel : "gemini";
        currentTurn.alias = agyAlias !== "?" ? agyAlias : "gemini";
        currentTurn.effort = agyEffort;
      }
      continue;
    }

    if (e.type === "PLANNER_RESPONSE") {
      if (!currentTurn) {
        currentTurn = openTurn(t, null);
        currentTurn.model = agyModel !== "?" ? agyModel : "gemini";
        currentTurn.alias = agyAlias !== "?" ? agyAlias : "gemini";
        currentTurn.effort = agyEffort;
      }
      lastTurnAt = t;
      currentTurn.outTok += e.output_tokens || 0;
      if (typeof e.content === "string" && oneLine(e.content)) {
        currentTurn.summary = str(e.content, 140);
        currentTurn.result = e.content.trim();
      }
      const tcs = Array.isArray(e.tool_calls) ? e.tool_calls : [];
      if (tcs.length === 0) {
        currentTurn.isDone = true;
        currentTurn.end = t;
        continue;
      }
      currentTurn.isDone = false;
      currentTurn.end = null;
      for (const tc of tcs) {
        const name = oneLine(tc.name || "?");
        const args = tc.args || {};
        if (name === "send_message") continue;
        currentTurn.tools += 1;
        const arg = str([args.CommandLine, args.AbsolutePath, args.TargetFile, args.query, args.Url, args.toolSummary].map(unquoteArg).find(Boolean) || "", 56);
        currentTurn.lastTool = `${name}${arg ? ` ${arg}` : ""}`;
        if (currentTurn.toolTrail.length < 14) currentTurn.toolTrail.push(currentTurn.lastTool);
        const id = `step_${e.step_index ?? items.length}_${currentTurn.tools}`;

        const pathArg = unquoteArg(args.AbsolutePath);
        const skillMatch = name === "view_file" ? /[\\/]skills[\\/]([^\\/]+)[\\/]SKILL\.md$/i.exec(pathArg)?.[1] : null;
        if (skillMatch) {
          const shortSkill = oneLine(skillMatch).replace(/_/g, "-");
          if (!seenTurnSkills.has(shortSkill)) {
            seenTurnSkills.add(shortSkill);
            currentPhase = `Skill · ${shortSkill}`;
            items.push({
              kind: "skill",
              key: `skill:${id}`,
              label: `skill:${shortSkill}`,
              phase: currentPhase,
              alias: currentTurn.alias,
              model: currentTurn.model,
              effort: currentTurn.effort,
              start: t,
              end: t,
              isDone: true,
              tools: 1,
              lastTool: `Skill ${shortSkill}`,
              toolTrail: [`view_file ${shortSkill}/SKILL.md`],
              outTok: 0,
              summary: `Activated /${shortSkill}`,
              result: pathArg || `Activated /${shortSkill}`,
            });
          }
        } else if (name === "invoke_subagent") {
          awaitingSubagents = true;
          let list = Array.isArray(args.Subagents) ? args.Subagents : [];
          const rawSubs = unquoteArg(args.Subagents);
          if (!list.length && rawSubs) try {
            const parsed = JSON.parse(rawSubs);
            if (Array.isArray(parsed)) list = parsed;
          } catch {
            // The compact transcript truncates long args: recover each subagent's Role from what survives.
            for (const m of rawSubs.matchAll(/"Role"\s*:\s*"((?:\\.|[^"\\])*)"/g)) list.push({ Role: m[1].replace(/\\"/g, '"') });
          }
          for (let sIdx = 0; sIdx < list.length; sIdx++) {
            const sub = list[sIdx] || {};
            const desc = oneLine(sub.Role) || oneLine(sub.TypeName) || "subagent";
            const reqModel = oneLine(sub.Model);
            const reqAlias = reqModel && reqModel !== "inherit" ? reqModel : currentTurn.alias;
            const ag = {
              kind: "agent",
              key: `agent:${id}_${sIdx}`,
              agentId: null,
              label: `agent:${clip(desc, 48)}`,
              phase: currentPhase,
              alias: reqAlias || "gemini",
              model: currentTurn.model || "gemini",
              effort: currentTurn.effort || "n/a",
              start: t,
              end: null,
              isDone: false,
              tools: 0,
              lastTool: "",
              toolTrail: [],
              outTok: 0,
              summary: null,
              result: null,
            };
            pendingAgyAgents.push(ag);
            items.push(ag);
          }
        } else if (name === "run_command") {
          const cmd = unquoteArg(args.CommandLine);
          if (/(?:^|[;&|\r\n])\s*git\s+(?:-C\s+\S+\s+)?commit\b/.test(cmd)) {
            pendingAgyCommits.push({ id, cmd, phase: currentPhase, alias: currentTurn.alias, model: currentTurn.model, effort: currentTurn.effort, at: t });
          }
        }
      }
      continue;
    }

    if (e.type === "GENERIC") {
      const raw = typeof e.content === "string" ? e.content : "";
      if (awaitingSubagents && raw.includes("Created the following subagents:")) {
        awaitingSubagents = false;
        let sIdx = 0;
        for (const m of raw.matchAll(/"conversationId":\s*"([a-zA-Z0-9_-]+)"/g)) {
          const cid = m[1];
          if (agentsById.has(cid)) continue;
          let ag = pendingAgyAgents.shift();
          if (!ag && cid) {
            // No parsed invoke_subagent entry left to pair with: still show the subagent, named by its id.
            ag = {
              kind: "agent",
              key: `agent:agy_${t}_${sIdx}`,
              agentId: null,
              label: `agent:${clip(cid, 12)}`,
              phase: currentPhase,
              alias: currentTurn?.alias || "gemini",
              model: currentTurn?.model || "gemini",
              effort: currentTurn?.effort || "n/a",
              start: t,
              end: null,
              isDone: false,
              tools: 0,
              lastTool: "",
              toolTrail: [],
              outTok: 0,
              summary: null,
              result: null,
            };
            items.push(ag);
          }
          if (cid && ag) {
            ag.agentId = cid;
            agentsById.set(cid, ag);
          }
          sIdx++;
        }
        pendingAgyAgents.length = 0;
      } else if (pendingAgyCommits.length > 0 && raw.includes("The command exited with code")) {
        const pc = pendingAgyCommits.shift();
        if (pc && raw.includes("The command exited with code 0")) recordCommit(pc.id, pc, raw, t, "run_command");
      }
      continue;
    }

    if (e.type === "SYSTEM_MESSAGE") {
      const raw = typeof e.content === "string" ? e.content : "";
      for (const m of raw.matchAll(/\[Message\]\s+timestamp=[^\s]+\s+sender=([^\s]+)\s+priority=[^\s]+\s+content=([\s\S]*?)(?=\n\[Message\]|<\/SYSTEM_MESSAGE>|$)/g)) {
        const sender = oneLine(m[1]);
        const body = (m[2] || "").trim();
        if (sender === "system" && /subagents and background tasks have been stopped/i.test(body)) {
          for (const s of items) {
            if (s.kind === "agent" && !s.isDone) {
              s.isDone = true;
              s.isFailed = true;
              s.end = s.end ?? t;
              if (!s.result) s.result = "(stopped by server restart)";
            }
          }
        } else if (sender && agentsById.has(sender)) {
          const ag = agentsById.get(sender);
          ag.isDone = true;
          ag.end = ag.end ?? t;
          if (body && !ag.result) ag.result = body;
        }
      }
      continue;
    }

    if (e.type === "user") {
      const rawContent = toolResultText(msg.content);
      if (rawContent && (rawContent.includes("<agent-message") || rawContent.includes("<task-"))) {
        const am = /<agent-message\s+from="([^"]+)"[^>]*>([\s\S]*?)<\/agent-message>/i.exec(rawContent);
        const tnId = /<task-id>([^<]+)<\/task-id>/i.exec(rawContent)?.[1];
        const tnTool = /<tool-use-id>([^<]+)<\/tool-use-id>/i.exec(rawContent)?.[1];
        const aid = oneLine(am?.[1] ?? tnId);
        const ag = (aid ? agentsById.get(aid) : undefined) ?? (tnTool ? pendingAgents.get(oneLine(tnTool)) : undefined);
        if (ag) {
          if (aid && !ag.agentId) {
            ag.agentId = aid;
            agentsById.set(aid, ag);
          }
          ag.isDone = true;
          ag.end = ag.end ?? t;
          if (ag.phase) currentPhase = ag.phase;
          if (/<status>failed<\/status>/i.test(rawContent)) ag.isFailed = true;
          const sumMatch = /<summary>([^<]+)<\/summary>/i.exec(rawContent)?.[1] ?? am?.[2];
          if (sumMatch && !ag.result) ag.result = sumMatch.replace(/^\[Subagent\s+[^\]]+\]\s*/i, "").trim();
        }
      }

      if (Array.isArray(msg.content)) {
        for (const b of msg.content) {
          if (!b || b.type !== "tool_result") continue;
          const id = String(b.tool_use_id || "");
          const ag = pendingAgents.get(id);
          if (ag) {
            const tr = e.toolUseResult || {};
            if (typeof tr.agentId === "string" && oneLine(tr.agentId)) {
              ag.agentId = oneLine(tr.agentId);
              agentsById.set(ag.agentId, ag);
            }
            if (typeof tr.resolvedModel === "string" && oneLine(tr.resolvedModel) && (!ag.model || ag.model === "?")) {
              ag.model = oneLine(tr.resolvedModel);
              if (!ag.alias || ag.alias === "?") ag.alias = inferAlias(ag.model);
            }
            const isAsync = tr.isAsync === true || tr.status === "async_launched";
            if (b.is_error === true) {
              ag.isDone = true;
              ag.isFailed = true;
              ag.end = t;
              ag.result = toolResultText(b.content) || "(agent failed)";
            } else if (!isAsync) {
              ag.isDone = true;
              ag.end = t;
              const txt = toolResultText(b.content);
              if (txt && !ag.result) ag.result = txt.trim();
            }
          }

          const pc = pendingCommits.get(id);
          if (pc) {
            pendingCommits.delete(id);
            if (b.is_error !== true) {
              const out = `${toolResultText(b.content)}\n${e.toolUseResult?.stdout || ""}`.trim();
              recordCommit(id, pc, out, t, "Bash");
            }
          }
        }
      }

      if (!e.isMeta) {
        const prompt = cleanPrompt(msg.content);
        // The engine's interrupt marker is not something typed: it ends the turn, the next prompt opens one.
        const isInterrupt = prompt && /^\[Request interrupted by user/.test(prompt);
        if (prompt) {
          if (currentTurn && !currentTurn.isDone) {
            currentTurn.isDone = true;
            currentTurn.end = lastTurnAt;
            if (isInterrupt) currentTurn.summary = `(interrupted) ${currentTurn.summary || ""}`.trim();
          }
          if (!isInterrupt) currentTurn = openTurn(t, prompt);
        }
      }
    } else if (e.type === "attachment") {
      // A message typed while Claude works is folded into the running turn, so it opens none; the turn shows it as its prompt.
      const att = e.attachment || {};
      if (att.type === "queued_command" && att.commandMode === "prompt" && currentTurn) {
        const text = cleanPrompt(att.prompt);
        if (text) currentTurn.prompt = `(mid-turn) ${text}`;
      }
    } else if (e.type === "assistant") {
      if (!currentTurn) currentTurn = openTurn(t, null);
      lastTurnAt = t;
      if (msg.model && msg.model !== "<synthetic>") {
        const cleanM = oneLine(msg.model);
        turnModels.add(cleanM);
        currentTurn.model = [...turnModels].join(", ");
        currentTurn.alias = inferAlias(cleanM);
      }
      if (e.effort) {
        turnEfforts.add(oneLine(e.effort));
        currentTurn.effort = [...turnEfforts].join(", ");
      }
      const uTok = msg.usage?.output_tokens || 0;
      if (typeof msg.id === "string") {
        const prevTok = seenMsgTokens.get(msg.id) || 0;
        if (uTok > prevTok) {
          currentTurn.outTok += uTok - prevTok;
          seenMsgTokens.set(msg.id, uTok);
        }
      } else {
        currentTurn.outTok += uTok;
      }
      if (msg.stop_reason === "end_turn") {
        currentTurn.isDone = true;
        currentTurn.end = t;
      } else if (msg.stop_reason === "tool_use") {
        currentTurn.isDone = false;
        currentTurn.end = null;
      }

      for (const b of Array.isArray(msg.content) ? msg.content : []) {
        if (!b) continue;
        // The client's own filler after an interrupt (<synthetic> "No response requested.") is not Claude's answer.
        if (b.type === "text" && typeof b.text === "string" && oneLine(b.text) && msg.model !== "<synthetic>") {
          currentTurn.summary = str(b.text, 140);
          currentTurn.result = b.text.trim();
        }
        if (b.type !== "tool_use") continue;
        currentTurn.tools += 1;
        const i = b.input || {};
        const name = oneLine(b.name || "?");
        const arg = str(i.command || i.file_path || i.pattern || i.description || i.skill || "", 56);
        currentTurn.lastTool = `${name}${arg ? ` ${arg}` : ""}`;
        if (currentTurn.toolTrail.length < 14) currentTurn.toolTrail.push(currentTurn.lastTool);
        const id = String(b.id || items.length);

        if (name === "Skill") {
          const rawSkill = oneLine(i.skill || "skill");
          const shortSkill = rawSkill.replace(/^alon-skills:/, "");
          currentPhase = `Skill · ${shortSkill}`;
          const argsText = typeof i.args === "string" && i.args.trim() ? i.args.trim() : `Activated /${shortSkill}`;
          items.push({
            kind: "skill",
            key: `skill:${id}`,
            label: `skill:${shortSkill}`,
            phase: currentPhase,
            alias: currentTurn.alias,
            model: currentTurn.model,
            effort: currentTurn.effort,
            start: t,
            end: t,
            isDone: true,
            tools: 1,
            lastTool: `Skill ${shortSkill}`,
            toolTrail: [`Skill ${rawSkill}`],
            outTok: 0,
            summary: str(argsText, 140),
            result: argsText,
          });
        } else if (name === "Agent") {
          const desc = oneLine(i.description) || oneLine(i.subagent_type) || "subagent";
          const meta = metaByToolUse.get(id);
          const ag = {
            kind: "agent",
            key: `agent:${id}`,
            agentId: meta?.agentId || null,
            label: `agent:${clip(desc, 48)}`,
            phase: currentPhase,
            alias: (i.model ? oneLine(i.model) : null) || meta?.model || "?",
            model: "?",
            effort: "n/a",
            start: t,
            end: null,
            isDone: false,
            tools: 0,
            lastTool: "",
            toolTrail: [],
            outTok: 0,
            summary: null,
            result: null,
          };
          pendingAgents.set(id, ag);
          if (ag.agentId) agentsById.set(ag.agentId, ag);
          items.push(ag);
        } else if ((name === "Bash" || name === "PowerShell") && typeof i.command === "string" && /(?:^|[;&|\r\n])\s*git\s+(?:-C\s+\S+\s+)?commit\b/.test(i.command)) {
          pendingCommits.set(id, { cmd: i.command, phase: currentPhase, alias: currentTurn.alias, model: currentTurn.model, effort: currentTurn.effort, at: t });
        }
      }
    }
  }

  // Enrich spawned subagents from <session>/subagents/agent-<id>.jsonl or Antigravity brain/<id>/...
  for (const s of items) {
    if (s.kind === "turn") {
      if (!s.isDone) s.end = Date.now();
      continue;
    }
    if (s.kind !== "agent") continue;
    if (s.agentId && VALID_ID.test(s.agentId) && subagentsDir) {
      const m = safeJson(join(subagentsDir, `agent-${s.agentId}.meta.json`));
      if (m?.model && (!s.alias || s.alias === "?")) s.alias = oneLine(m.model);
      const claudeTranscript = join(subagentsDir, `agent-${s.agentId}.jsonl`);
      const agyTranscript = join(subagentsDir, s.agentId, ".system_generated", "logs", "transcript.jsonl");
      const info = readAgentTranscript(existsSync(claudeTranscript) ? claudeTranscript : agyTranscript);
      s.start = info.first ?? s.start;
      if (info.handback) {
        s.isDone = true;
        s.result = info.handback;
      }
      if (s.isDone) {
        s.end = info.last ?? s.end ?? s.start;
        if (!s.result && info.lastText) s.result = info.lastText;
      } else {
        s.end = Date.now();
      }
      s.tools = info.tools;
      s.lastTool = info.lastTool;
      s.toolTrail = info.toolTrail;
      s.outTok = info.outTok;
      if (info.model !== "?") s.model = info.model;
      if (s.alias === "?" && s.model !== "?") s.alias = inferAlias(s.model);
      if (info.effort !== "n/a") s.effort = info.effort;
    } else if (!s.isDone) {
      s.end = Date.now();
    }
    s.summary = s.result ? str(s.result, 140) : s.isDone ? "(completed)" : "no result yet";
  }

  return items;
}

function readTarget(t) {
  const sessionItems = readSession(t.sessionFile, t.subagentsDir);
  const wfItems = readWorkflowRun(t.wfDir);
  if (sessionItems.length === 0) return wfItems;
  if (wfItems.length === 0) return sessionItems;
  return [...sessionItems, ...wfItems].sort((a, b) => (a.start ?? 0) - (b.start ?? 0));
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
  if (s.isFailed) return "fail";
  if (s.kind && s.kind !== "stage") return "ok";
  const r = s.result;
  if (s.died || r == null) return "empty";
  if (typeof r === "object" && (r.verdict === "fail" || r.ok === false)) return "fail";
  // A fix round that left findings for the arbiter: neither a pass nor a failure.
  if (typeof r === "object" && Array.isArray(r.notFixed) && r.notFixed.length) return "disputed";
  return "ok";
}

const GLYPH = { run: "▶", ok: "✓", fail: "!", disputed: "!", empty: "✗" };
const WORD = { run: "running", ok: "done", fail: "failed", disputed: "disputed", empty: "no result" };
const KIND_LABEL = { stage: "STAGE", turn: "TURN", skill: "SKILL", agent: "AGENT", commit: "COMMIT" };

// "low" ... "max", and "na" for a model that records none ("n/a"); a stage whose turns ran at several levels gets each.
const effortClass = (e) =>
  String(e)
    .split(/,\s*/)
    .map((x) => x.replace(/[^a-z]/gi, ""))
    .join(" ");

function fullResult(s) {
  if (!s.isDone) return "No result yet.";
  if (s.died) return "(stopped without a result: the journal recorded the stage as failed)";
  if (s.result == null) return "(no result)";
  return typeof s.result === "string" ? s.result : JSON.stringify(s.result, null, 2);
}

// The path as ~/.claude/projects/…/<session> or ~/.gemini/antigravity/brain/<cid>/transcript.jsonl.
function shortDir(dir) {
  const same = (a, b) => (process.platform === "win32" ? a.toLowerCase() === b.toLowerCase() : a === b);
  const home = resolve(homedir()).split(/[\\/]+/);
  let parts = resolve(dir).split(/[\\/]+/);
  if (home.length < parts.length && home.every((h, i) => same(h, parts[i]))) parts = ["~", ...parts.slice(home.length)];
  const p = parts.findIndex((x, i) => x === "projects" && parts[i - 1] === ".claude");
  if (p >= 0 && p + 1 < parts.length) parts = [...parts.slice(0, p + 1), "…", ...parts.slice(p + 2)];
  const sysIdx = parts.indexOf(".system_generated");
  if (sysIdx >= 0 && parts[sysIdx + 1] === "logs") parts = [...parts.slice(0, sysIdx), ...parts.slice(sysIdx + 2)];
  return parts.join("/");
}

function waterfallSection(stages, t0, total) {
  if (stages.length < 2) return "";
  const rows = stages.map((s, idx) => {
    const v = verdict(s);
    const kind = s.kind || "stage";
    const ran = s.start ? Math.max(0, s.end - s.start) : 0;
    const from = s.start ? Math.max(0, s.start - t0) : 0;
    const left = s.start ? Math.min(98.5, (from / total) * 100) : 0;
    const width = s.start ? Math.max(1.2, Math.min(100 - left, (ran / total) * 100)) : 1.2;
    const tier = v === "fail" || v === "empty" ? "bad" : v === "run" || v === "disputed" ? "warn" : kind === "commit" ? "commit" : kind === "skill" ? "skill" : s.alias || "ok";
    return `<a class="wf-row ${esc(v)}" href="#stage-${idx}" title="${esc(`${s.label} (${clock(ran)}, ${kTok(s.outTok)} tokens)`)}">
<span class="wf-lbl"><span class="wf-st ${esc(v)}" aria-hidden="true">${esc(GLYPH[v])}</span><span class="kd ${esc(kind)}">${esc(KIND_LABEL[kind] || "STAGE")}</span><span class="wf-name">${esc(s.label)}</span></span>
<span class="wf-track"><i class="g g1"></i><i class="g g2"></i><i class="g g3"></i><span class="wf-bar ${esc(tier)}" style="left:${esc(left.toFixed(1))}%;width:${esc(width.toFixed(1))}%"></span></span>
<span class="wf-meta"><span>${esc(clock(ran))}</span><span class="wf-tok">${esc(s.outTok ? kTok(s.outTok) : "—")}</span></span>
</a>`;
  });

  return `<section class="waterfall" aria-label="Execution timeline">
<div class="wf-head">
<h2>Timeline Waterfall</h2>
<div class="wf-legend">
<span class="lg"><i class="sw fable"></i>fable</span>
<span class="lg"><i class="sw opus"></i>opus</span>
<span class="lg"><i class="sw sonnet"></i>sonnet</span>
<span class="lg"><i class="sw haiku"></i>haiku</span>
<span class="lg"><i class="sw gemini"></i>gemini</span>
<span class="lg"><i class="sw bad"></i>failed</span>
</div>
</div>
<div class="wf-axis"><span>Timeline Item</span><span class="wf-ticks"><span>+0:00</span><span>+${esc(clock(total * 0.25))}</span><span>+${esc(clock(total * 0.5))}</span><span>+${esc(clock(total * 0.75))}</span><span>+${esc(clock(total))}</span></span><span>Dur / Tok</span></div>
<div class="wf-body">
${rows.join("\n")}
</div>
</section>`;
}

function card(s, idx, t0, total) {
  const v = verdict(s);
  const kind = s.kind || "stage";
  const ran = s.start ? Math.max(0, s.end - s.start) : null;
  const from = s.start ? Math.max(0, s.start - t0) : null;
  const left = s.start ? Math.min(99, (from / total) * 100) : 0;
  const width = s.start ? Math.max(0.8, Math.min(100 - left, (ran / total) * 100)) : 0;
  const line =
    v === "run"
      ? "no result yet"
      : s.died
        ? "(stopped without a result)"
        : s.summary || summarize(s.label, s.result);
  const fold =
    v === "run"
      ? `Running for ${clock(ran)} · ${many(s.tools, "call", "calls")} · ${s.lastTool || "starting"}`
      : `Ran for ${clock(ran)} · ${many(s.tools, "tool", "tools")} · ${kTok(s.outTok)} tokens`;
  const span = s.start ? `+${clock(from)} to +${clock(from + ran)} of ${clock(total)}` : "not started";
  const promptBlock =
    s.prompt && kind === "turn"
      ? `<div class="prompt"><span class="pk">PROMPT</span><span>${esc(clip(oneLine(s.prompt), 200))}</span></div>`
      : "";
  const trailBlock =
    Array.isArray(s.toolTrail) && s.toolTrail.length > 0
      ? `<div class="trail">${s.toolTrail.map((t) => `<code class="tc">${esc(t)}</code>`).join("")}${s.tools > s.toolTrail.length ? `<span class="tc-more">+${s.tools - s.toolTrail.length} more</span>` : ""}</div>`
      : "";

  // The status and label are the card's heading, so heading navigation walks the stages.
  return `<article id="stage-${idx}" class="stage ${esc(v)} kind-${esc(kind)}">
<div class="card-top">
<h3 class="top"><span class="st"><span aria-hidden="true">${esc(GLYPH[v])}</span> ${esc(WORD[v])}</span><span class="kd ${esc(kind)}">${esc(KIND_LABEL[kind] || "STAGE")}</span><span class="lb">${esc(s.label)}</span></h3>
<div class="metrics"><span class="mp">${esc(clock(ran))}</span><span class="mp">${esc(many(s.tools, "tool", "tools"))}</span>${s.outTok ? `<span class="mp tok">${esc(kTok(s.outTok))} tok</span>` : ""}</div>
</div>
<div class="who"><span class="m ${esc(s.alias)}">${esc(s.alias)}</span><span>→</span><span class="id">${esc(s.model)}</span><span class="ef ${esc(effortClass(s.effort))}">${esc(s.effort)}</span></div>
${promptBlock}
<p class="res">${esc(clip(oneLine(line), 240))}</p>
<details${v === "run" ? " open" : ""}><summary>${esc(fold)}</summary><div class="more">
<div class="tl"><div class="track"><div class="fill" style="left:${esc(left.toFixed(1))}%;width:${esc(width.toFixed(1))}%"></div></div><span>${esc(span)}</span></div>
${trailBlock}
<pre tabindex="0">${esc(fullResult(s))}</pre>
</div></details>
</article>`;
}

function page(targetInfo, stages, watchActive = false) {
  const validStarts = stages.filter((s) => s.start).map((s) => s.start);
  const t0 = validStarts.length ? validStarts.reduce((a, b) => Math.min(a, b), Infinity) : Date.now();
  const t1 = stages.length ? stages.reduce((m, s) => Math.max(m, s.end ?? t0), t0) : t0;
  const total = Math.max(1, t1 - t0);
  const tokens = stages.reduce((n, s) => n + s.outTok, 0);
  const totalTools = stages.reduce((n, s) => n + s.tools, 0);

  // Run order, with a divider each time the phase changes (a second refute round gets its own, named by
  // the round its labels carry: `refute:…:r2`).
  let prev = null;
  const feed = stages.map((s, idx) => {
    const round = /:r(\d+)$/.exec(s.label)?.[1];
    const divider = s.phase !== prev ? `<h2 class="phase"><span class="ph-dot"></span>${esc(s.phase || "(no phase)")}${round ? ` · round ${esc(round)}` : ""}</h2>\n` : "";
    prev = s.phase;
    return divider + card(s, idx, t0, total);
  });

  // Every stage counted once, as its card shows it; failed includes no result.
  const n = { ok: 0, disputed: 0, bad: 0, run: 0 };
  const byKind = { stage: 0, turn: 0, skill: 0, agent: 0, commit: 0 };
  for (const s of stages) {
    const v = verdict(s);
    n[v === "fail" || v === "empty" ? "bad" : v] += 1;
    byKind[s.kind || "stage"] = (byKind[s.kind || "stage"] || 0) + 1;
  }
  const isFinished = stages.length > 0 && n.run === 0;
  const state = `${n.ok} done${n.disputed ? ` · ${n.disputed} disputed` : ""} · ${n.bad} failed · ${n.run} running · ${clock(total)} elapsed · ${kTok(tokens)} output tokens${isFinished ? " · finished" : ""}`;
  const srcPrefix = targetInfo.source === "antigravity" ? "ANTIGRAVITY · " : targetInfo.source === "claude" ? "CLAUDE CODE · " : "";
  const modeBadge = `${srcPrefix}${targetInfo.mode === "session" ? "SESSION TRACKER" : "WORKFLOW TRACKER"}`;
  const statusBanner = n.run > 0 ? { cls: "run", txt: `▶ ${n.run} running` } : n.bad > 0 ? { cls: "bad", txt: `! ${n.bad} failed` } : { cls: "ok", txt: "✓ all clear" };
  const titleText = targetInfo.mode === "session" && targetInfo.wfDir ? `${targetInfo.id.slice(0, 8)} · ${basename(targetInfo.wfDir)}` : targetInfo.id;

  const kpiChips = [
    `<div class="kpi ok"><span class="k-v">${n.ok}</span><span class="k-l">Done</span></div>`,
    n.disputed ? `<div class="kpi warn"><span class="k-v">${n.disputed}</span><span class="k-l">Disputed</span></div>` : "",
    `<div class="kpi ${n.bad ? "bad" : ""}"><span class="k-v">${n.bad}</span><span class="k-l">Failed</span></div>`,
    `<div class="kpi ${n.run ? "warn" : ""}"><span class="k-v">${n.run}</span><span class="k-l">Running</span></div>`,
    byKind.turn ? `<div class="kpi"><span class="k-v">${byKind.turn}</span><span class="k-l">Turns</span></div>` : "",
    byKind.agent || byKind.stage ? `<div class="kpi"><span class="k-v">${byKind.agent + byKind.stage}</span><span class="k-l">${byKind.stage ? "Stages" : "Subagents"}</span></div>` : "",
    byKind.skill ? `<div class="kpi"><span class="k-v">${byKind.skill}</span><span class="k-l">Skills</span></div>` : "",
    byKind.commit ? `<div class="kpi"><span class="k-v">${byKind.commit}</span><span class="k-l">Commits</span></div>` : "",
    `<div class="kpi"><span class="k-v">${esc(clock(total))}</span><span class="k-l">Elapsed</span></div>`,
    `<div class="kpi"><span class="k-v">${esc(kTok(tokens))}</span><span class="k-l">Output Tok (${totalTools} tools)</span></div>`,
  ]
    .filter(Boolean)
    .join("");

  const watchScript = watchActive
    ? `<script>(()=>{try{const k="tracker-ui-"+${JSON.stringify(targetInfo.id)};const s=JSON.parse(sessionStorage.getItem(k)||"null");if(s){if(Array.isArray(s.open))document.querySelectorAll("article.stage details").forEach((d,i)=>{if(s.open.includes(i))d.open=true});if(typeof s.y==="number")window.scrollTo(0,s.y)}setTimeout(()=>{const open=[];document.querySelectorAll("article.stage details").forEach((d,i)=>{if(d.open)open.push(i)});sessionStorage.setItem(k,JSON.stringify({y:window.scrollY,open}));location.reload()},5000)}catch{}})()</script>`
    : "";

  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${esc(titleText)}</title><style>
:root{--bg:#0b0d12;--card:#131720;--card-hi:#181d28;--line:#242a38;--line-hi:#31394d;--fg:#eef0f6;--dim:#8e98ae;--acc:#7aa2f7;--ok:#4fcf8a;--bad:#ff7b72;--warn:#f0c35b;--mono:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;--sans:system-ui,-apple-system,"Segoe UI",Roboto,sans-serif}
*{box-sizing:border-box}
html{scroll-behavior:smooth}
body{margin:0;background:radial-gradient(circle at 50% 0%,#151b28 0%,var(--bg) 55%);color:var(--fg);font:14px/1.5 var(--sans)}
main{max-width:900px;margin:0 auto;padding:24px;display:flex;flex-direction:column;gap:12px}
.head,.waterfall,.stage{background:var(--card);border:1px solid var(--line);border-radius:12px;padding:14px 18px;box-shadow:0 4px 16px rgba(0,0,0,.22)}
.head-top{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:8px}
.head-title{display:flex;flex-wrap:wrap;align-items:center;gap:10px;min-width:0}
.mode-pill{font:700 10.5px/1 var(--sans);letter-spacing:.08em;padding:4px 8px;border-radius:6px;background:#1e2638;color:var(--acc);border:1px solid #2e3b59}
.status-pill{font:600 12px/1 var(--mono);padding:5px 10px;border-radius:999px;border:1px solid var(--line)}
.status-pill.ok{background:rgba(79,207,138,.1);color:var(--ok);border-color:rgba(79,207,138,.3)}
.status-pill.bad{background:rgba(255,123,114,.12);color:var(--bad);border-color:rgba(255,123,114,.35)}
.status-pill.run{background:rgba(240,195,91,.12);color:var(--warn);border-color:rgba(240,195,91,.35)}
.head h1{margin:0;font:600 17px/1.3 var(--mono);overflow-wrap:anywhere}
.head p.sub{margin:6px 0 0;color:var(--dim);font:12.5px/1.45 var(--mono)}
.kpis{display:flex;flex-wrap:wrap;gap:8px;margin-top:12px;padding-top:12px;border-top:1px solid #1d2230}
.kpi{flex:1 1 82px;min-width:78px;background:#0e121a;border:1px solid #1f2533;border-radius:8px;padding:7px 10px;display:flex;flex-direction:column;gap:1px}
.kpi.ok .k-v{color:var(--ok)} .kpi.bad .k-v{color:var(--bad)} .kpi.warn .k-v{color:var(--warn)}
.k-v{font:700 14.5px/1.2 var(--mono);color:var(--fg)} .k-l{font:500 11px/1.2 var(--sans);color:var(--dim)}

.waterfall{padding:14px 18px}
.wf-head{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:8px;margin-bottom:10px}
.wf-head h2{margin:0;font:600 12.5px/1.2 var(--sans);letter-spacing:.06em;text-transform:uppercase;color:var(--acc)}
.wf-legend{display:flex;flex-wrap:wrap;gap:10px;font:11.5px/1.2 var(--mono);color:var(--dim)}
.lg{display:inline-flex;align-items:center;gap:5px}
.sw{display:inline-block;width:10px;height:10px;border-radius:3px;background:#5b84d6}
.sw.fable,.wf-bar.fable{background:#8b6cf6} .sw.opus,.wf-bar.opus{background:#5b8bf7} .sw.sonnet,.wf-bar.sonnet{background:#3ec98f} .sw.haiku,.wf-bar.haiku{background:#e5a94c} .sw.gemini,.wf-bar.gemini{background:#2ac3de} .sw.bad,.wf-bar.bad{background:var(--bad)} .wf-bar.warn{background:var(--warn)} .wf-bar.skill{background:#c678dd} .wf-bar.commit{background:#56b6c2}
.wf-axis{display:grid;grid-template-columns:230px 1fr 92px;gap:10px;padding:0 6px 5px;border-bottom:1px solid #1f2533;color:var(--dim);font:11px/1.2 var(--mono)}
.wf-ticks{display:flex;justify-content:space-between}
.wf-body{display:flex;flex-direction:column;gap:3px;margin-top:6px}
.wf-row{display:grid;grid-template-columns:230px 1fr 92px;align-items:center;gap:10px;padding:4px 6px;border-radius:6px;text-decoration:none;color:var(--fg);font:12px/1.3 var(--mono)}
.wf-row:hover{background:var(--card-hi)}
.wf-lbl{display:flex;align-items:center;gap:6px;min-width:0;overflow:hidden;white-space:nowrap;text-overflow:ellipsis}
.wf-st{font-weight:700;font-size:11.5px} .wf-st.ok{color:var(--ok)} .wf-st.fail,.wf-st.empty{color:var(--bad)} .wf-st.run,.wf-st.disputed{color:var(--warn)}
.wf-name{overflow:hidden;text-overflow:ellipsis}
.wf-track{position:relative;height:10px;background:#0e121a;border-radius:5px;overflow:hidden;border:1px solid #1d2331}
.wf-track .g{position:absolute;top:0;bottom:0;width:1px;background:#1c2230}
.wf-track .g1{left:25%} .wf-track .g2{left:50%} .wf-track .g3{left:75%}
.wf-bar{position:absolute;top:1px;bottom:1px;border-radius:4px;min-width:4px}
.wf-meta{display:flex;justify-content:space-between;gap:6px;color:var(--dim);font-size:11.5px;white-space:nowrap}
.wf-tok{color:#6f7a92}

.phase{display:flex;align-items:center;gap:10px;margin:14px 0 2px;color:var(--acc);font:700 11.5px/1.2 var(--sans);letter-spacing:.07em;text-transform:uppercase}
.ph-dot{width:7px;height:7px;border-radius:50%;background:var(--acc);box-shadow:0 0 8px var(--acc)}
.phase::after{content:"";flex:1 1 0;height:1px;background:linear-gradient(90deg,var(--line-hi),transparent)}

.stage{border-left:3.5px solid var(--ok);transition:border-color .15s,background .15s}
.stage:target{outline:2px solid var(--acc);outline-offset:2px}
.stage.run,.stage.disputed{border-left-color:var(--warn)} .stage.fail,.stage.empty{border-left-color:var(--bad);background:linear-gradient(90deg,rgba(255,123,114,.05),var(--card) 28%)}
.card-top{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:6px 12px}
.top{display:flex;flex-wrap:wrap;align-items:center;gap:6px 10px;margin:0;font:inherit;min-width:0}
.st{font:600 12px/1.2 var(--mono);padding:2px 7px;border-radius:5px;white-space:nowrap}
.ok .st{color:var(--ok);background:rgba(79,207,138,.1)} .run .st,.disputed .st{color:var(--warn);background:rgba(240,195,91,.12)} .fail .st,.empty .st{color:var(--bad);background:rgba(255,123,114,.14)}
.kd{font:700 10px/1 var(--sans);letter-spacing:.06em;padding:2.5px 5.5px;border-radius:4px;background:#1e2433;color:var(--dim);border:1px solid #2b3245}
.kd.turn{color:#9ece6a;border-color:#2e4229;background:#182318}
.kd.skill{color:#e0af68;border-color:#473822;background:#261f16}
.kd.agent{color:#7dcfff;border-color:#234257;background:#14232e}
.kd.commit{color:#bb9af7;border-color:#3a2e54;background:#1f192b}
.lb{min-width:0;font:600 14px/1.35 var(--mono);overflow-wrap:anywhere}
.metrics{display:flex;flex-wrap:wrap;align-items:center;gap:5px}
.mp{font:11.5px/1.2 var(--mono);padding:2px 7px;border-radius:5px;background:#0e121a;border:1px solid #1f2533;color:var(--dim);white-space:nowrap}
.mp.tok{color:#b4bece}
.who{display:flex;flex-wrap:wrap;align-items:center;gap:4px 8px;margin-top:7px;color:var(--dim);font:12px/1.4 var(--mono)} .id{min-width:0;overflow-wrap:anywhere}
.m{font-size:11px;font-weight:600;padding:1px 6px;border-radius:4px;background:#232838;color:var(--dim)} .m.fable{background:#3b2f6b;color:#d9ccff} .m.opus{background:#2d3f6b;color:#cfe0ff} .m.sonnet{background:#1f4a3a;color:#b9f0d2} .m.haiku{background:#4a3a1f;color:#f3dfae} .m.gemini{background:#163d4a;color:#a6e8f7}
.ef{font-size:11px;padding:0 6px;border:1px solid var(--line);border-radius:4px;color:var(--dim)} .ef.na{border-style:dashed;font-style:italic}
.ef.medium{color:#c3cad8;border-color:#343a48} .ef.high{color:#d9ccff;border-color:#4b3f80} .ef.xhigh{color:#f3dfae;border-color:#6b5528} .ef.max{color:#ffb3ad;border-color:#7a3a36;font-weight:700}
.prompt{margin-top:8px;padding:6px 10px;background:#0e121a;border-left:2px solid var(--acc);border-radius:0 6px 6px 0;color:#c3cad8;font:12.5px/1.45 var(--sans);display:flex;align-items:baseline;gap:8px;overflow-wrap:anywhere}
.pk{font:700 10px/1 var(--mono);letter-spacing:.06em;color:var(--acc);flex-shrink:0}
.res{margin:8px 0 0;color:#dde1ec;overflow-wrap:anywhere} .fail .res,.empty .res{color:#ffb3ad;font-weight:500}
details{margin-top:9px;padding-top:7px;border-top:1px solid #1d2230}
summary{cursor:pointer;color:var(--dim);font:12px/1.5 var(--mono);overflow-wrap:anywhere} summary:hover{color:var(--fg)} summary:focus-visible{outline:2px solid var(--acc);outline-offset:2px;border-radius:4px}
.more{display:flex;flex-direction:column;gap:10px;margin-top:8px}
.track{position:relative;height:8px;overflow:hidden;background:#0e121a;border-radius:4px;border:1px solid #1f2533} .fill{position:absolute;top:0;height:8px;border-radius:4px;background:#5b84d6} .run .fill,.disputed .fill{background:var(--warn)} .fail .fill,.empty .fill{background:var(--bad)}
.tl span{display:block;margin-top:4px;color:var(--dim);font:11.5px/1.4 var(--mono)}
.trail{display:flex;flex-wrap:wrap;gap:5px}
.tc{font:11px/1.3 var(--mono);padding:2px 6px;background:#0e121a;border:1px solid #1f2533;border-radius:4px;color:#9aa5ce;max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.tc-more{font:11px/1.3 var(--mono);color:var(--dim);padding:2px 4px}
pre{max-height:18em;overflow:auto;margin:0;padding:10px 12px;background:#0d1017;border:1px solid #1d2230;border-radius:8px;color:#c9cfdb;font:12px/1.45 var(--mono);white-space:pre-wrap;overflow-wrap:anywhere}
.foot{padding:6px 2px 0;color:var(--dim);font-size:12px} .foot code{display:block;margin-bottom:2px;color:var(--fg);font:12px/1.45 var(--mono);overflow-wrap:anywhere}
@media (max-width:640px){main{padding:12px 10px}.head,.waterfall,.stage{padding:10px 12px}.wf-axis,.wf-row{grid-template-columns:140px 1fr 68px}}
</style></head><body><main>
<header class="head">
<div class="head-top">
<div class="head-title"><span class="mode-pill">${esc(modeBadge)}</span><h1>${esc(titleText)}</h1></div>
<span class="status-pill ${esc(statusBanner.cls)}">${esc(statusBanner.txt)}</span>
</div>
<p class="sub">${esc(state)}</p>
<div class="kpis">${kpiChips}</div>
</header>
${waterfallSection(stages, t0, total)}
${feed.join("\n") || `<p class="res">No activity recorded yet.</p>`}
<footer class="foot"><code>${esc(shortDir(targetInfo.dir))}</code>tokens are the output tokens generated, thinking included · each bar is the item's start and length on the timeline · rendered ${esc(new Date().toISOString())}</footer>
</main>${watchScript}</body></html>`;
}

function findBrowserExe() {
  const roots = [
    join(homedir(), "AppData", "Local", "ms-playwright"),
    join(homedir(), ".cache", "ms-playwright"),
    join(homedir(), "Library", "Caches", "ms-playwright"),
  ];
  for (const root of roots) {
    for (const dir of safeList(root).sort().reverse()) {
      for (const rel of [
        ["chrome-headless-shell-win64", "chrome-headless-shell.exe"],
        ["chrome-win64", "chrome.exe"],
        ["chrome-linux", "chrome"],
        ["chrome-mac", "Chromium.app", "Contents", "MacOS", "Chromium"],
      ]) {
        const candidate = join(root, dir, ...rel);
        if (existsSync(candidate)) return candidate;
      }
    }
  }
  return null;
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
  let b;
  try {
    b = await pw.chromium.launch();
  } catch (e) {
    const exe = findBrowserExe();
    if (!exe) throw e;
    b = await pw.chromium.launch({ executablePath: exe });
  }
  const p = await b.newPage({ viewport: { width: 940, height: 800 }, deviceScaleFactor: 2 });
  await p.goto(pathToFileURL(html).href);
  await (await p.$("main")).screenshot({ path: png });
  await b.close();
  return true;
}

const out = resolve(val("--out", "tracker.html"));
const png = val("--png", "");
const isWatch = flag("--watch");
do {
  const stages = readTarget(target);
  const live = stages.filter((s) => !s.isDone).length;
  const keepWatching = isWatch && (target.mode === "session" || stages.length === 0 || live > 0);
  writeFileSync(out, page(target, stages, keepWatching), "utf8");
  console.log(`${target.id}: ${stages.length} items (${target.source || target.mode}), ${live} running -> ${out}`);
  if (png && (await screenshot(out, resolve(png)))) console.log(`screenshot -> ${resolve(png)}`);
  // A workflow run with no stages yet has not finished: --watch waits for its first. Sessions stay watched until Ctrl+C.
  if (!keepWatching) break;
  await sleep(5000);
} while (true);
