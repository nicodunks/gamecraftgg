// GameCraft generation pipeline (pipeline/docs/02-generation-pipeline.md).
//   Local/CLI mode:  node pipeline/run.mjs --prompt "a game about ..." [--id <id>] [--ref <ref>] [--edit <slug>]
//   Fleet mode:      node pipeline/run.mjs --job <generationId>   (GC_REPORT_URL + GC_JOB_TOKEN in env)
// Requires the `claude` CLI (Claude Code) on PATH. Agents in the loop:
//   creator (designs + builds + playtests its own work) -> [smoke gate + judge] x cycles -> publish
// ALL side effects (trace, status, publish, refund) go through the Reporter —
// this file never touches the DB or the ledger directly. See reporter.mjs.
import { execFileSync, spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { createReporter } from './reporter.mjs';

const APP = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const MAX_CYCLES = 3;
const PASS_SCORE = 80;

// ---------- args & reporter ----------
const args = process.argv.slice(2);
function arg(name) {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : undefined;
}
const jobId = arg('job');            // fleet mode: fetch the job over HTTP
const jobLocalId = arg('job-local'); // app-dispatched on this box: job from the DB row
const remote = !!jobId;
const genId = jobId ?? jobLocalId ?? arg('id') ?? crypto.randomBytes(8).toString('hex');
if (!remote && !jobLocalId && !arg('prompt')) {
  console.error('usage: node pipeline/run.mjs --prompt "..." [--id <id>] [--ref <ref>] [--edit <slug>]  |  --job <id>  |  --job-local <id>');
  process.exit(2);
}

const R = await createReporter({
  remote,
  genId,
  fromDb: !!jobLocalId,
  prompt: arg('prompt'),
  ref: arg('ref') ?? '',
  editSlug: arg('edit') ?? '',
});
const job = await R.getJob();
const prompt = job.prompt;
const creatorRef = job.ref ?? '';   // owner of the resulting game
const editSlug = job.editSlug ?? ''; // if set, iterate an existing game in place
const GAMES_DIR = R.gamesDir();

function trace(kind, detail, stream) {
  R.trace(kind, detail, stream);
  console.log(`[${kind}${stream ? '/' + stream : ''}] ${String(detail).slice(0, 160)}`);
}
const setGen = (fields) => void R.set(fields);

if (remote && process.env.FLY_MACHINE_ID) {
  trace('worker', `worker ${process.env.FLY_MACHINE_ID} picked up the job (${process.env.FLY_REGION ?? '?'})`);
}

// ---------- agent spend (the input to credit pricing) ----------
// Every `claude -p` run ends with a `result` event carrying total_cost_usd and
// token usage, so the CLI does the price math for us. We accumulate per phase
// because the phase breakdown is what tells us which stage to make cheaper.
const _cost = { total: 0, calls: 0, byPhase: {}, tokens: { in: 0, out: 0, cacheRead: 0, cacheWrite: 0 }, models: {} };
let _cycles = 0;
function recordCost(phase, ev) {
  const usd = typeof ev.total_cost_usd === 'number' ? ev.total_cost_usd : 0;
  const u = ev.usage ?? {};
  _cost.total += usd;
  _cost.calls += 1;
  const p = (_cost.byPhase[phase] ??= { usd: 0, calls: 0 });
  p.usd += usd;
  p.calls += 1;
  _cost.tokens.in += u.input_tokens ?? 0;
  _cost.tokens.out += u.output_tokens ?? 0;
  _cost.tokens.cacheRead += u.cache_read_input_tokens ?? 0;
  _cost.tokens.cacheWrite += u.cache_creation_input_tokens ?? 0;
  for (const m of Object.keys(ev.modelUsage ?? {})) _cost.models[m] = (_cost.models[m] ?? 0) + 1;
  setGen({ cost: JSON.stringify(_cost) });
  trace(phase, `spend: $${usd.toFixed(3)} (run total $${_cost.total.toFixed(2)})`, 'tool');
}

// ---------- claude helper (streaming) ----------
// Streams the agent's turns so the build page shows every thinking step, tool
// call, and message live — instead of hanging on one blocking call. Returns the
// concatenated assistant text for parsing. `cwd` sets the judge's working dir to
// the game folder for convenience, but is NOT a security boundary — Read can
// still take absolute/`../` paths. The creator prompt is untrusted, so PRODUCTION
// must run this pipeline inside the sandboxed build-worker container from
// 05-architecture.md (filesystem-isolated), not on a host with app secrets.
// TODO(prod): sandbox the judge; until then treat generation as trusted-operator.
function short(s, n = 150) {
  const one = String(s).replace(/\s+/g, ' ').trim();
  return one.length > n ? one.slice(0, n) + '…' : one;
}
// Cost per game is dominated by model choice, so pin it per role rather than
// inheriting whatever the CLI defaults to (that default is not stable, which
// makes spend unpredictable in production). Override per role via env.
// Two roles since the 2026-07 merge: CREATOR (designs AND builds — one head,
// no lossy brief handoff) and JUDGE (separate context on purpose: the maker
// never grades its own work). Both on Opus 5 (founder call, 2026-07-24).
const MODELS = {
  creator: process.env.GS_MODEL_CREATOR || 'claude-opus-5',
  judge: process.env.GS_MODEL_JUDGE || 'claude-opus-5',
};
// Reasoning effort per role: the creator writes the game — full effort; judge
// scoring holds quality at medium with meaningfully less latency (founder-set).
const EFFORT = {
  creator: process.env.GS_EFFORT_CREATOR || 'high',
  judge: process.env.GS_EFFORT_JUDGE || 'medium',
};

function claude(rolePrompt, { tools, timeoutMin = 15, cwd = APP, phase = 'agent', playtestSlug } = {}) {
  return new Promise((resolve, reject) => {
    const cliArgs = ['-p', rolePrompt, '--output-format', 'stream-json', '--verbose'];
    if (MODELS[phase]) cliArgs.push('--model', MODELS[phase]);
    if (EFFORT[phase]) cliArgs.push('--effort', EFFORT[phase]);
    if (tools) {
      cliArgs.push('--allowedTools', tools, '--permission-mode', 'acceptEdits');
      // The prompt is untrusted creator input. A shell would let a hostile
      // prompt read the host env/DB; the web would let it exfiltrate. Deny
      // EXPLICITLY — ambient user/project settings must never widen a
      // pipeline agent's toolbox (observed leaking on a dev box).
      cliArgs.push('--disallowedTools', 'Bash,BashOutput,KillShell,WebFetch,WebSearch,Task,Agent,NotebookEdit,TodoWrite');
    }
    if (playtestSlug) {
      // the dynamic playtest tool: a per-game MCP server the agent drives with
      // inputs IT chooses (every game's controls differ). --strict-mcp-config
      // so the agent gets exactly this server and nothing ambient.
      const cfg = JSON.stringify({
        mcpServers: {
          playtest: { command: 'node', args: [path.join(APP, 'scripts', 'playtest-mcp.mjs'), '--slug', playtestSlug, '--app', APP] },
        },
      });
      cliArgs.push('--mcp-config', cfg, '--strict-mcp-config');
    }
    const child = spawn('claude', cliArgs, { cwd, stdio: ['ignore', 'pipe', 'pipe'] });

    let fullText = '';
    let buf = '';
    let stderr = '';
    const timer = setTimeout(() => {
      trace(phase, `timed out after ${timeoutMin} min — moving on`, 'tool');
      child.kill('SIGKILL');
    }, timeoutMin * 60 * 1000);

    function handleEvent(ev) {
      if (!ev || typeof ev !== 'object') return;
      if (ev.type === 'result') recordCost(phase, ev);
      if (ev.type === 'assistant' && ev.message?.content) {
        for (const b of ev.message.content) {
          if (b.type === 'text' && b.text) {
            fullText += b.text;
            trace(phase, short(b.text, 220), 'say');
          } else if (b.type === 'thinking' && b.thinking) {
            trace(phase, short(b.thinking, 220), 'thinking');
          } else if (b.type === 'tool_use') {
            const inp = b.input ? short(JSON.stringify(b.input), 120) : '';
            trace(phase, `${b.name} ${inp}`, 'tool');
          }
        }
      } else if (ev.type === 'result' && typeof ev.result === 'string' && !fullText) {
        fullText = ev.result; // fallback if no assistant text blocks were seen
      }
    }

    child.stdout.on('data', (chunk) => {
      buf += chunk.toString();
      let nl;
      while ((nl = buf.indexOf('\n')) >= 0) {
        const line = buf.slice(0, nl).trim();
        buf = buf.slice(nl + 1);
        if (!line) continue;
        let parsed;
        try {
          parsed = JSON.parse(line);
        } catch {
          continue; // non-JSON line from the CLI — ignore
        }
        // NOT inside the parse try: a bug in our own handler must surface, not
        // masquerade as an unparseable line.
        handleEvent(parsed);
      }
    });
    child.stderr.on('data', (c) => (stderr += c.toString()));
    child.on('error', (e) => {
      clearTimeout(timer);
      reject(new Error(`claude spawn failed: ${e.message}`));
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      void R.set({}); // nudge a flush so the tail of this agent's stream lands
      if (fullText) resolve(fullText);
      else reject(new Error(`claude exited ${code} with no output${stderr ? ': ' + short(stderr, 300) : ''}`));
    });
  });
}

function extractBlock(text, lang) {
  const re = new RegExp('```' + lang + '\\s*\\n([\\s\\S]*?)\\n```');
  const m = text.match(re);
  return m ? m[1] : null;
}
function extractJson(text) {
  const block = extractBlock(text, 'json');
  if (block) return JSON.parse(block);
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start >= 0 && end > start) return JSON.parse(text.slice(start, end + 1));
  throw new Error('no JSON found in agent output');
}

// These live INSIDE the app tree (pipeline/docs) — the Docker build context is
// the app folder, so a parent-relative path would be missing in production
// (which is exactly how the first prod run died). And they load inside the try:
// any startup crash must reach the catch, which marks the generation failed
// and refunds the debit — a pre-try crash strands a paid 'running' row.
let conventions, rubric, designGuidance;

try {
  conventions = fs.readFileSync(path.join(APP, 'CONVENTIONS.md'), 'utf8');
  rubric = fs.readFileSync(path.join(APP, 'pipeline', 'docs', '03-quality-rubric.md'), 'utf8');
  designGuidance = fs.readFileSync(path.join(APP, 'pipeline', 'docs', '02-generation-pipeline.md'), 'utf8');

  let brief = '';
  let meta, gameDir;
  let editSnapshot = null; // for edit mode: restore the game if the edit fails to pass
  const isEdit = !!editSlug && !!job.editFiles?.['index.html'];
  if (editSlug && !isEdit) throw new Error(`edit requested but ${editSlug} has no game files`);

  // The creator prompt injects ONLY the design half of the pipeline doc (the
  // two design laws, fun-drive dials, depth levers). The build contract is
  // CONVENTIONS.md; the rest of the doc is factory plumbing the artisan
  // doesn't need in context.
  const stage1Start = designGuidance.indexOf('## Stage 1');
  const stage1End = designGuidance.indexOf('## Stage 2');
  const designLaws = stage1Start >= 0 && stage1End > stage1Start ? designGuidance.slice(stage1Start, stage1End) : designGuidance;

  // New games are built in a wip dir so the creator never blocks on naming —
  // meta.json names the game, and the final slug is claimed at publish time.
  let dirSlug; // the folder name the playtest tool serves during the build
  if (isEdit) {
    // The job carries the current game files (locally read from disk; in fleet
    // mode fetched from the app) — write them into the working dir, and keep
    // the originals as the snapshot so a failed edit reverts cleanly.
    gameDir = path.join(GAMES_DIR, editSlug);
    dirSlug = editSlug;
    fs.mkdirSync(gameDir, { recursive: true });
    for (const [f, buf] of Object.entries(job.editFiles)) {
      if (buf) fs.writeFileSync(path.join(gameDir, f), buf);
    }
    meta = JSON.parse(fs.readFileSync(path.join(gameDir, 'meta.json'), 'utf8')); // keep slug/title/boards
    editSnapshot = {
      'index.html': job.editFiles['index.html'],
      'cover.svg': job.editFiles['cover.svg'] ?? null,
      'DESIGN_BRIEF.md': job.editFiles['DESIGN_BRIEF.md'] ?? null,
    };
    setGen({ slug: editSlug });
  } else {
    dirSlug = `wip-${genId.slice(0, 8)}`;
    gameDir = path.join(GAMES_DIR, dirSlug);
    fs.mkdirSync(gameDir, { recursive: true });
  }

  // meta.json comes off DISK now (the creator writes it like every other
  // file) — normalize instead of trusting, and never kill a paid run over a
  // bad name: sanitize the slug or fall back to a generated one.
  function readMeta() {
    let m = {};
    try {
      m = JSON.parse(fs.readFileSync(path.join(gameDir, 'meta.json'), 'utf8'));
    } catch {
      m = {};
    }
    let slug = String(m.slug ?? '')
      .toLowerCase()
      .replace(/[^a-z0-9-]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 40);
    if (!/^[a-z0-9-]{3,40}$/.test(slug)) slug = `game-${genId.slice(0, 6)}`;
    m.slug = slug;
    m.title = m.title ?? slug;
    if (!Array.isArray(m.dials) || m.dials.length === 0) m.dials = ['mastery'];
    return m;
  }

  // ---------- creator + smoke-test + judge loop ----------
  const CREATOR_TOOLS = 'Read,Write,Edit,mcp__playtest__playtest';
  const newGamePrompt = `You are the GameCraft CREATOR — one agent who DESIGNS and BUILDS a small, instantly-fun browser game. There is no separate designer or builder: you own the taste and the code, and you playtest your own work as you go.

DESIGN GUIDANCE (this is what makes games good — the two design laws are non-negotiable):
${designLaws}

CONVENTIONS (binding contract — the judge enforces these):
${conventions}

Creator's prompt: "${prompt}"

Work in this order, writing every file DIRECTLY TO DISK in your working directory (it IS the game folder):
1. DESIGN_BRIEF.md — think here first, before any code. Fun-drive dials, core verb (≤5 words), the twist, failure model, structure/escalation, toy check if physics, art direction (specific hexes, shape language), sound & juice plan, controls (desktop AND touch), rendering route (canvas2d preferred; phaser only if physics-heavy). Be opinionated and specific — this brief is the promise the judge scores you against.
2. meta.json — per the conventions schema (slug: kebab-case, unique-feeling, not a common word).
3. index.html — the complete game. A game is 40-70KB and does not fit in a chat message — use Write, and Edit for fixes.
4. cover.svg — 640x400, in the game's own art language.
5. PLAYTEST IT with the playtest tool — at least one desktop run and one mobile run, driving the controls YOUR game actually uses (the tool takes your own action list; there is no generic script). Then LOOK at the screenshots with Read. If the core verb isn't visibly working and fun in them, fix it and test again. If your game has simulated motion, use a long observe window to demonstrate a run actually TERMINATES and the goal is reachable — physics is a thing you prove, not hope.

You have at most 6 playtest calls — spend them like a founder, not a perfectionist. Ship when a friend would say "one more try", not when it is perfect.
When the files are on disk and your last playtest looks right, reply with only: DONE`;

  const editPrompt = `You are the GameCraft CREATOR editing an EXISTING game. Apply the creator's change — keep everything that works, change only what the prompt asks (plus anything your change breaks).

DESIGN GUIDANCE (the two design laws still apply to the changed game):
${designLaws}

CONVENTIONS (binding contract):
${conventions}

Change request: "${prompt}"

Your working directory IS the game folder: read ./DESIGN_BRIEF.md and ./index.html first. Then:
1. Update DESIGN_BRIEF.md so it stays the truthful promise of the changed game (full brief, not a diff).
2. Edit index.html in place — do NOT rewrite the whole file.
3. Update cover.svg only if the look changed.
4. PLAYTEST with the playtest tool (desktop + mobile, the game's real controls) and LOOK at the screenshots — prove the change works and nothing regressed.

When done and your last playtest looks right, reply with only: DONE`;

  let critique = '';
  let published = false;
  for (let cycle = 1; cycle <= MAX_CYCLES; cycle++) {
    _cycles = cycle;
    setGen({ cycles: cycle });
    trace(
      'creator',
      cycle === 1 ? (isEdit ? `Editing "${meta.title}" per your prompt…` : 'Dreaming it up, then building it…') : `Fixing per critique (cycle ${cycle})…`
    );
    const cyclePrompt =
      cycle === 1
        ? isEdit
          ? editPrompt
          : newGamePrompt
        : `${isEdit ? editPrompt : newGamePrompt}

PREVIOUS ATTEMPT FAILED VERIFICATION. Your files already exist in the working directory — use Edit to fix them, do NOT rewrite from scratch, and change nothing that already works. Fix ALL of this judge critique, then RE-PLAYTEST to prove the fixes:
${critique}`;
    const runCreator = () =>
      claude(cyclePrompt, {
        tools: CREATOR_TOOLS,
        cwd: gameDir,
        timeoutMin: 45,
        phase: 'creator',
        playtestSlug: dirSlug,
      });
    // One retry on a mid-stream API failure: the creator is the longest, most
    // expensive call in the run, and a transient CLI/API drop should not burn a
    // whole cycle (which costs the creator a credit refund round-trip).
    try {
      await runCreator();
    } catch (e) {
      trace('creator', `creator run failed (${short(e.message, 120)}) — retrying once`, 'tool');
      await runCreator();
    }
    // Disk is the contract, not the transcript.
    const htmlPath = path.join(gameDir, 'index.html');
    if (!fs.existsSync(htmlPath) || fs.statSync(htmlPath).size < 500) {
      throw new Error('creator produced no index.html');
    }
    if (!isEdit) meta = readMeta();
    fs.writeFileSync(path.join(gameDir, 'meta.json'), JSON.stringify(meta, null, 2));
    try {
      brief = fs.readFileSync(path.join(gameDir, 'DESIGN_BRIEF.md'), 'utf8');
    } catch {
      brief = '(the creator wrote no brief)';
    }
    setGen({ brief });
    trace('creator', `Brief ready: "${meta.title}" — dials: ${JSON.stringify(meta.dials ?? [])}`);
    trace('creator', `index.html written (${(fs.statSync(htmlPath).size / 1024).toFixed(0)} KB)`);

    // deterministic smoke gate. Port 0 = OS-assigned, so concurrent builds can never
    // collide on a port (a bind failure here would burn a whole cycle); we parse
    // the actual port from the server's startup line, which doubles as the
    // readiness signal (replaces the old fixed sleep).
    trace('playtest', 'Smoke-testing on desktop + mobile…');
    const server = spawn('node', ['scripts/game-server.mjs', '0'], { cwd: APP, stdio: ['ignore', 'pipe', 'ignore'] });
    let verifyOut = '';
    let verifyFailed = false;
    try {
      const port = await new Promise((resolve, reject) => {
        const to = setTimeout(() => reject(new Error('game server did not start within 10s')), 10_000);
        let out = '';
        server.stdout.on('data', (c) => {
          out += c.toString();
          const m = out.match(/localhost:(\d+)/);
          if (m) { clearTimeout(to); resolve(Number(m[1])); }
        });
        server.on('exit', () => { clearTimeout(to); reject(new Error('game server exited before listening')); });
      });
      try {
        verifyOut = execFileSync('node', ['scripts/verify-game.mjs', dirSlug, String(port)], {
          cwd: APP,
          encoding: 'utf8',
          timeout: 120_000,
        });
      } catch (e) {
        verifyOut = (e.stdout ?? '') + (e.stderr ?? '');
        verifyFailed = true;
      }
    } finally {
      server.kill();
    }
    trace('playtest', verifyOut.split('\n').filter(Boolean).slice(-8).join(' | '));

    // judge — a separate context ON PURPOSE: the maker never grades its own
    // work, and a fresh head catches what the creator's context went blind to.
    trace('judge', 'The judge is playing it…');
    const runJudge = () =>
      claude(
        `You are the GameCraft JUDGE PANEL (feel, taste, fun-drive, integration, content judges in one pass). You did not make this game and you owe its maker nothing — the publish gate is only real if you are willing to fail things. Score strictly against the rubric; be generous to declared archetypes and specific in critique.

RUBRIC:
${rubric}

DESIGN BRIEF (the promise to judge against):
${brief}

SMOKE-TEST OUTPUT (deterministic load check: console errors, bridge messages):
${verifyOut || '(harness produced no output)'}
Smoke-test hard-fail: ${verifyFailed}

EVIDENCE RULES — verdict from evidence only:
- PLAY THE GAME YOURSELF with the playtest tool: at least one desktop run and one mobile run, driving the controls the brief declares (you choose the inputs — there is no generic script). Your screenshots land in ./_shots/ next to the creator's; LOOK at them with Read.
- READ ./index.html. Read ONLY files within this folder (your working directory IS the game folder). Judge art direction from the screenshots like an art director.
- Default to "fix" when evidence is missing: if you cannot SEE the core verb working in the screenshots, it does not work.

PHYSICS INTEGRITY (rubric U3a — weight this heavily, it's the #1 failure mode): if the game has simulated motion, do NOT pass it unless you can justify from the code + YOUR OWN playtest evidence that (1) a run reliably TERMINATES — reaching a goal/death/end; use a long observe window to witness it; flag any "flies forever / never loses / unbounded run with no resolution" as a CRITICAL fail; (2) the run is WINNABLE/completable by skilled play — read the level/goal geometry and the physics constants and reason about whether the goal is actually reachable; an unwinnable or impossible layout is a CRITICAL fail; (3) the feel is FORGIVING (not instant-death/brittle); (4) nothing freezes, tunnels, sticks, NaNs, or launches to infinity. Reason explicitly about termination and winnability in your critique. Do not assume the constants are tuned right — check them.

Write the critique TO the creator as an ordered fixlist — it is handed back verbatim for the fix cycle.
Output ONLY a \`\`\`json fence: {"score": 0-100, "criticalFails": ["..."], "critique": "specific, actionable, ordered by importance", "verdict": "publish" | "fix"}`,
        { tools: 'Read,mcp__playtest__playtest', cwd: gameDir, phase: 'judge', playtestSlug: dirSlug }
      );
    // one retry on an unparseable verdict — a malformed fence must not burn a
    // whole paid cycle
    let verdict;
    try {
      verdict = extractJson(await runJudge());
    } catch (e) {
      trace('judge', `verdict unparseable (${short(e.message, 80)}) — re-asking the judge`, 'tool');
      verdict = extractJson(await runJudge());
    }
    trace('judge', `score ${verdict.score}/100, critical fails: ${verdict.criticalFails?.length ?? 0} — ${verdict.verdict}`);
    setGen({ verdict: JSON.stringify(verdict) });

    if (verdict.verdict === 'publish' && verdict.score >= PASS_SCORE && !(verdict.criticalFails?.length) && !verifyFailed) {
      published = true;
      break;
    }
    critique = `${verdict.critique}\nCritical fails: ${JSON.stringify(verdict.criticalFails)}\nHarness output:\n${verifyOut.slice(0, 2000)}`;
  }

  if (published) {
    if (!isEdit) {
      // Claim the real name: the creator built in a wip dir so it never blocked
      // on naming; meta.json names the game. Rename the dir (EEXIST = a
      // concurrent run took the slug — suffix and move on) and rewrite any
      // baked-in wip-slug references (localStorage keys like gs_best:<slug>).
      let target = path.join(GAMES_DIR, meta.slug);
      try {
        fs.renameSync(gameDir, target);
      } catch (e) {
        if (e.code !== 'EEXIST' && e.code !== 'ENOTEMPTY') throw e;
        meta.slug = `${meta.slug}-${genId.slice(0, 4)}`;
        target = path.join(GAMES_DIR, meta.slug);
        fs.renameSync(gameDir, target);
      }
      gameDir = target;
      const htmlP = path.join(gameDir, 'index.html');
      fs.writeFileSync(htmlP, fs.readFileSync(htmlP, 'utf8').split(dirSlug).join(meta.slug));
      fs.writeFileSync(path.join(gameDir, 'meta.json'), JSON.stringify(meta, null, 2));
    }
    // A judge-passed game becomes a DRAFT owned by its creator — it does NOT
    // hit the public library until the creator clicks Publish. The reporter
    // owns the mechanics (row + published.json locally; file upload + server-
    // side slug resolution in fleet mode) and returns the final slug.
    const finalSlug = await R.publish(meta, creatorRef, gameDir);
    meta.slug = finalSlug;
    setGen({ slug: finalSlug });
    trace('publish', editSlug ? `Updated: /g/${finalSlug}` : `Live: /g/${finalSlug}`);
    await R.finish('published'); // generation status (done), not game visibility
  } else if (editSnapshot) {
    // A failed EDIT must never break the live game — restore the pre-edit files.
    for (const [f, buf] of Object.entries(editSnapshot)) {
      if (buf) fs.writeFileSync(path.join(gameDir, f), buf);
    }
    trace('fail', 'The edit did not pass — your game is unchanged. Try a different change.');
    await R.finish('failed'); // failed runs refund app-side (or via LocalReporter)
  } else {
    // New game, not vetted — remove the build so it can never be sync-published (C1).
    try { fs.rmSync(gameDir, { recursive: true, force: true }); } catch { /* ignore */ }
    trace('fail', 'Cycle budget exhausted — not published. The critique is available for a re-prompt.');
    await R.finish('failed');
  }
  const byPhase = Object.entries(_cost.byPhase)
    .sort((a, b) => b[1].usd - a[1].usd)
    .map(([k, v]) => `${k} $${v.usd.toFixed(2)}(${v.calls})`)
    .join('  ');
  console.log(`\nCOST id=${genId} total=$${_cost.total.toFixed(3)} calls=${_cost.calls} cycles=${_cycles} phases: ${byPhase}`);
} catch (err) {
  trace('error', err.message ?? String(err));
  try {
    await R.finish('failed');
  } catch (e) {
    console.error('could not report failure:', e.message ?? e); // reaper will catch it
  }
  console.log(`\nCOST id=${genId} total=$${_cost.total.toFixed(3)} calls=${_cost.calls} status=error`);
  process.exit(1);
}
