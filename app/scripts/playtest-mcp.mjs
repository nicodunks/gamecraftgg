// Dynamic playtest tool, exposed to the pipeline agents over MCP (stdio).
// The creator and the judge both drive it: each call boots a throwaway game
// server, loads the game in a real Chromium (desktop or mobile emulation),
// performs the AGENT-SPECIFIED inputs — every game is different, so the agent
// describes the inputs its game actually uses — and returns console errors,
// platform-bridge messages (ready/score/gameover), and screenshot paths the
// agent then LOOKS at with Read. Screenshots land in the game folder's
// _shots/ so the judge sees the creator's evidence too.
//
// Usage (spawned by pipeline/run.mjs via --mcp-config):
//   node scripts/playtest-mcp.mjs --slug <dir-slug> --app <app-root>
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { chromium, devices } from 'playwright';

function argOf(name, def) {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : def;
}
const SLUG = argOf('slug');
const APP = argOf('app', process.cwd());
if (!SLUG) {
  process.stderr.write('playtest-mcp: --slug required\n');
  process.exit(2);
}
const SHOT_DIR = path.join(APP, 'games', SLUG, '_shots');

const HARNESS = `
  window.__gs = { msgs: [], errors: [] };
  window.addEventListener('message', (e) => { if (e.data && e.data.gs) window.__gs.msgs.push(e.data); });
`;

// Hard ceilings so a wild action list can never hang a build.
const MAX_ACTIONS = 60;
const MAX_WAIT_MS = 10_000;
const MAX_OBSERVE_MS = 20_000;
const RUN_TIMEOUT_MS = 120_000;

let runCounter = 0;

async function playtest(input) {
  const viewport = input.viewport === 'mobile' ? 'mobile' : 'desktop';
  const actions = Array.isArray(input.actions) ? input.actions.slice(0, MAX_ACTIONS) : [];
  const observeMs = Math.min(Math.max(Number(input.observe_ms) || 4000, 0), MAX_OBSERVE_MS);
  const n = ++runCounter;
  fs.mkdirSync(SHOT_DIR, { recursive: true });

  // throwaway server per call: port 0 = OS-assigned, no collisions ever
  const server = spawn('node', ['scripts/game-server.mjs', '0'], { cwd: APP, stdio: ['ignore', 'pipe', 'ignore'] });
  let browser;
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

    browser = await chromium.launch();
    const ctx = await browser.newContext(viewport === 'mobile' ? { ...devices['iPhone 13'] } : { viewport: { width: 1280, height: 720 } });
    const page = await ctx.newPage();
    const errors = [];
    page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
    page.on('pageerror', (e) => errors.push(String(e)));
    await page.addInitScript(HARNESS);
    await page.goto(`http://localhost:${port}/play/${SLUG}/`, { waitUntil: 'load' });
    await page.waitForTimeout(1200);

    const shots = [];
    async function shot(tag) {
      const rel = path.join('_shots', `pt${n}-${viewport}-${tag}.png`);
      await page.screenshot({ path: path.join(APP, 'games', SLUG, rel) });
      shots.push(rel);
    }
    await shot('1-loaded');

    // the agent's own input script — every game gets the inputs IT needs
    const log = [];
    for (const a of actions) {
      try {
        switch (a.type) {
          case 'key': {
            const repeat = Math.min(Math.max(Number(a.repeat) || 1, 1), 30);
            const everyMs = Math.min(Math.max(Number(a.every_ms) || 120, 20), 2000);
            for (let i = 0; i < repeat; i++) {
              if (a.hold_ms) {
                await page.keyboard.down(a.key);
                await page.waitForTimeout(Math.min(Number(a.hold_ms), MAX_WAIT_MS));
                await page.keyboard.up(a.key);
              } else {
                await page.keyboard.press(a.key);
              }
              if (i < repeat - 1) await page.waitForTimeout(everyMs);
            }
            log.push(`key ${a.key}${a.hold_ms ? ` held ${a.hold_ms}ms` : ''}${repeat > 1 ? ` x${repeat}` : ''}`);
            break;
          }
          case 'tap':
          case 'click': {
            if (viewport === 'mobile') await page.touchscreen.tap(a.x, a.y);
            else await page.mouse.click(a.x, a.y);
            log.push(`${a.type} @ ${a.x},${a.y}`);
            break;
          }
          case 'drag': {
            const ms = Math.min(Math.max(Number(a.ms) || 400, 60), 4000);
            const steps = Math.max(4, Math.round(ms / 60));
            await page.mouse.move(a.x1, a.y1);
            await page.mouse.down();
            for (let s = 1; s <= steps; s++) {
              await page.mouse.move(a.x1 + ((a.x2 - a.x1) * s) / steps, a.y1 + ((a.y2 - a.y1) * s) / steps);
              await page.waitForTimeout(ms / steps);
            }
            await page.mouse.up();
            log.push(`drag ${a.x1},${a.y1} -> ${a.x2},${a.y2} over ${ms}ms`);
            break;
          }
          case 'move': {
            await page.mouse.move(a.x, a.y);
            log.push(`move @ ${a.x},${a.y}`);
            break;
          }
          case 'wait': {
            await page.waitForTimeout(Math.min(Math.max(Number(a.ms) || 500, 0), MAX_WAIT_MS));
            log.push(`wait ${a.ms}ms`);
            break;
          }
          default:
            log.push(`(skipped unknown action type "${a.type}")`);
        }
      } catch (e) {
        log.push(`(action ${a.type} failed: ${String(e.message).slice(0, 120)})`);
      }
    }
    await shot('2-after-input');
    if (observeMs > 0) await page.waitForTimeout(observeMs);
    await shot('3-end');

    const msgs = await page.evaluate(() => window.__gs.msgs);
    await browser.close();
    browser = null;

    const scores = msgs.filter((m) => m.score != null).map((m) => m.score);
    const bridge = msgs.map((m) => m.gs + (m.score != null ? `:${m.score}` : m.scores ? `:${JSON.stringify(m.scores)}` : '')).join(', ') || '(none — no ready message is a hard problem)';
    return [
      `PLAYTEST #${n} (${viewport}) — ${actions.length} actions, then observed ${observeMs}ms`,
      `console errors: ${errors.length}${errors.length ? '\n  ' + errors.slice(0, 6).map((e) => e.slice(0, 200)).join('\n  ') : ''}`,
      `bridge messages: ${bridge}`,
      scores.length ? `score progression: ${scores.join(' -> ')}` : 'score progression: (no score messages seen)',
      `inputs performed: ${log.join('; ') || '(none)'}`,
      `screenshots (LOOK at each with Read): ${shots.join('  ')}`,
    ].join('\n');
  } finally {
    if (browser) await browser.close().catch(() => {});
    server.kill();
  }
}

// ---------- minimal MCP stdio server (JSON-RPC 2.0, newline-delimited) ----------
const TOOL = {
  name: 'playtest',
  description:
    'Play the game in a real browser with inputs YOU choose. Boots the game, runs your action list, and returns console errors, platform bridge messages (ready/score/gameover), score progression, and screenshot paths — read the screenshots afterwards to SEE the game. Call once per viewport at minimum (desktop and mobile use different controls).',
  inputSchema: {
    type: 'object',
    properties: {
      viewport: { type: 'string', enum: ['desktop', 'mobile'], description: 'desktop = 1280x720 + mouse/keyboard; mobile = iPhone 13 + touch' },
      actions: {
        type: 'array',
        description:
          'Inputs in order. {type:"key",key:"Space"|"ArrowLeft"|…,hold_ms?,repeat?,every_ms?} | {type:"tap"|"click",x,y} | {type:"drag",x1,y1,x2,y2,ms?} | {type:"move",x,y} | {type:"wait",ms}. Drive the controls THIS game actually uses.',
        items: { type: 'object' },
      },
      observe_ms: { type: 'number', description: 'How long to keep watching after the inputs (default 4000, max 20000) — use a long observe to demonstrate a run terminating.' },
    },
    required: ['viewport', 'actions'],
  },
};

let buf = '';
process.stdin.on('data', (chunk) => {
  buf += chunk.toString();
  let nl;
  while ((nl = buf.indexOf('\n')) >= 0) {
    const line = buf.slice(0, nl).trim();
    buf = buf.slice(nl + 1);
    if (!line) continue;
    let msg;
    try {
      msg = JSON.parse(line);
    } catch {
      continue;
    }
    void handle(msg);
  }
});

function reply(id, result) {
  process.stdout.write(JSON.stringify({ jsonrpc: '2.0', id, result }) + '\n');
}
function replyErr(id, code, message) {
  process.stdout.write(JSON.stringify({ jsonrpc: '2.0', id, error: { code, message } }) + '\n');
}

async function handle(msg) {
  if (msg.id == null) return; // notification — nothing to do
  switch (msg.method) {
    case 'initialize':
      return reply(msg.id, {
        protocolVersion: msg.params?.protocolVersion ?? '2024-11-05',
        capabilities: { tools: {} },
        serverInfo: { name: 'playtest', version: '1.0.0' },
      });
    case 'ping':
      return reply(msg.id, {});
    case 'tools/list':
      return reply(msg.id, { tools: [TOOL] });
    case 'tools/call': {
      if (msg.params?.name !== 'playtest') return replyErr(msg.id, -32602, `unknown tool ${msg.params?.name}`);
      try {
        const text = await Promise.race([
          playtest(msg.params.arguments ?? {}),
          new Promise((_, rej) => setTimeout(() => rej(new Error('playtest timed out')), RUN_TIMEOUT_MS)),
        ]);
        return reply(msg.id, { content: [{ type: 'text', text }] });
      } catch (e) {
        return reply(msg.id, { content: [{ type: 'text', text: `playtest failed: ${e.message}` }], isError: true });
      }
    }
    default:
      return replyErr(msg.id, -32601, `method not found: ${msg.method}`);
  }
}
