// Regression test: bullseye-bender's complete multi-shot lifecycle.
// Guards the FLYING -> RESOLVE transition bug: resolve() must fire exactly
// once per shot (a goal scores once; a miss consumes exactly one strike and
// returns to AIM; three misses reach GAMEOVER; the next shot always works).
//
// Usage: node scripts/game-server.mjs 0  (grab port)  then
//        node scripts/test-bullseye.mjs <port>
// Drives the game's real globals (game / S / resolve) via page.evaluate —
// deterministic, no physics luck involved.
import { chromium } from 'playwright';

const port = process.argv[2];
if (!port) {
  console.error('usage: node scripts/test-bullseye.mjs <game-server-port>');
  process.exit(2);
}

let failures = 0;
function check(name, ok, detail = '') {
  console.log(`${ok ? '✓' : '✗ FAIL'} ${name}${detail ? ` — ${detail}` : ''}`);
  if (!ok) failures++;
}

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 420, height: 800 } });
const bridge = [];
await page.addInitScript(`window.__msgs=[]; window.addEventListener('message',e=>{if(e.data&&e.data.gs)window.__msgs.push(e.data)});`);
await page.goto(`http://localhost:${port}/play/bullseye-bender/`, { waitUntil: 'load' });
await page.waitForTimeout(800);

const st = () => page.evaluate(() => ({ state: game.state, strikes: game.strikes, score: game.score, level: game.level }));
const names = ['SPLASH', 'AIM', 'FLYING', 'RESOLVE', 'LEVELUP', 'GAMEOVER'];

// 1. splash -> aim
let s = await st();
check('loads at SPLASH', s.state === 0, names[s.state]);
await page.mouse.click(210, 400);
await page.waitForTimeout(300);
s = await st();
check('click -> AIM', s.state === 1, names[s.state]);

// 2. a real drag-shot leaves AIM (the input path works)
await page.mouse.move(210, 650);
await page.mouse.down();
await page.mouse.move(210, 740, { steps: 6 });
await page.mouse.up();
await page.waitForTimeout(200);
s = await st();
check('drag shot -> FLYING or already resolving', s.state === 2 || s.state === 3, names[s.state]);

// helper: force a deterministic resolution of the current/next shot
async function forceShot(type) {
  await page.evaluate((t) => {
    if (game.state !== S.FLYING) { game.state = S.FLYING; game.ball = game.ball || {}; game.ball.live = true; }
    resolve(game, t);
  }, type);
}
async function settle(ms = 2600) {
  await page.waitForTimeout(ms);
  return st();
}

// finish the in-flight shot as a MISS: exactly one strike, back to AIM
await forceShot('wide');
s = await st();
check('miss -> RESOLVE immediately', s.state === 3, names[s.state]);
s = await settle();
check('miss consumed exactly one strike', s.strikes === 2, `strikes=${s.strikes}`);
check('after miss -> back to AIM', s.state === 1, names[s.state]);
check('miss did not score', s.score === 0, `score=${s.score}`);

// 3. second shot works; a goal scores exactly once
await forceShot('goal');
await page.waitForTimeout(120);
const s1 = await st();
await page.waitForTimeout(400);
const s2 = await st();
check('goal scored once (score stable across frames)', s1.score > 0 && s1.score === s2.score, `${s1.score} -> ${s2.score}`);
s = await settle();
check('goal -> LEVELUP -> AIM, no strike lost', s.state === 1 && s.strikes === 2, `${names[s.state]} strikes=${s.strikes}`);
check('level advanced', s.level === 2, `level=${s.level}`);

// 4. two more misses reach GAMEOVER
await forceShot('short');
await settle();
await forceShot('over');
s = await settle();
check('three total misses -> GAMEOVER', s.state === 5, names[s.state]);
check('strikes exhausted', s.strikes === 0, `strikes=${s.strikes}`);
const msgs = await page.evaluate(() => window.__msgs.map((m) => m.gs));
check('gameover bridge message posted', msgs.includes('gameover'), msgs.join(','));

await browser.close();
console.log(failures === 0 ? '\nALL PASS' : `\n${failures} FAILURES`);
process.exit(failures === 0 ? 0 : 1);
