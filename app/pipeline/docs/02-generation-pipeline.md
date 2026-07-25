# 02 — Generation Pipeline (the agentic core)

Founder's core requirement: **agentic verification, not deterministic tests.** Agents are in the loop at runtime — designing, building, playing, and judging each game as it is created. The quality bar in `03-quality-rubric.md` is enforced by LLM judges reasoning over play evidence, never by scripted assertions.

Two agents since the 2026-07 merge, on purpose. The CREATOR designs and builds in ONE context — a strong model designs better while building, because design choices stay constrained by what is implementable, and a brief handoff between separate agents is lossy in both directions. The JUDGE stays a separate context — not as a "layer" but as an incentive boundary: the maker never grades its own work, and a fresh head catches what the maker's context has gone blind to. Playtesting is a TOOL, not a persona: both agents drive a real browser with inputs they choose per game (every game's controls differ), and verdict from raw evidence they saw themselves.

## Pipeline stages

```
PROMPT
  │
  ▼
CREATOR AGENT — one head, designs AND builds
  │  1. writes DESIGN_BRIEF.md (thinks first — high taste, opinionated)
  │  2. writes meta.json + index.html + cover.svg against CONVENTIONS.md
  │  3. PLAYTESTS its own work (playtest tool: real browser, desktop + mobile,
  │     inputs of its choosing) and iterates until the screenshots look fun
  ▼
SMOKE GATE (deterministic, objective) — loads on both viewports, zero console
  │  errors, gs:'ready' bridge fires. Cheap and non-negotiable.
  ▼
JUDGE PANEL (one pass: feel · taste · fun-drive · integration · content)
  │  plays the game ITSELF via the same playtest tool, reads the code, looks
  │  at all screenshots — verdict from evidence only, default-fail
  └─ fail → ordered fixlist → CREATOR fixes + re-playtests → re-verify (≤3 cycles)
  ▼
PUBLISH → CDN + URL + leaderboard/challenge wiring + feed entry
```

## Stage 1 — Design (the creator's first job: heavy planning, high taste)

Happens before any code, in the same context that will build. Produces `DESIGN_BRIEF.md` — the promise the judge scores against. The design job is to make a *specific, opinionated* game — not to funnel every prompt into a precision-skill archetype. The creative space is the whole flash canon, not any two games. (The canon research lives in the planning repo; everything actionable from it is distilled into the laws and levers below — do not go looking for the research files at runtime.)

**Two universal design laws (apply to every game, every archetype — do not skip):**

- **Interesting decisions under pressure.** The core verb must put the player in front of a live, legible decision where their skill or judgment visibly changes the outcome. Interrogate the loop honestly before building: *if the optimal move is obvious and simply repeated, or if success and failure feel arbitrary rather than earned, the game is lame — no matter how novel or charming the premise.* Fun comes from tension, expression, and outcomes the player feels responsible for; a fresh theme cannot rescue a hollow verb. This is the single most common failure of a generated game and the judges weight it heavily.
- **The player performs the mechanic every time.** Retry / play-again returns the player to the real playable start state — including any aim, charge, place, or draw phase the verb requires — and never auto-executes the core action on their behalf. A replay that does the interesting part *for* the player quietly deletes the game. (This is also a build-contract requirement; see `CONVENTIONS.md`.)

**Depth levers (tools, not requirements — reach for the ones that fit the verb; a pure reflex, toy, or comedy game may use none, and forcing all of them at once bloats a game).** When a game feels thin, these are the reliable ways to add depth without adding verbs:

- **Meter a resource instead of granting a one-shot.** An ability the player *rations* moment-to-moment — a boost that drains a gauge while held and only recovers when released, a light that burns fuel, a limited charge to place — creates a live spend-now-vs-conserve decision on every use. The same ability as a free or one-tap action usually has far less depth. (Hold-to-consume beats tap-to-fire when you want strategy.)
- **Make upgrades tradeoffs and transformations, not stat bumps.** Progression lands hardest when tiers escalate in *kind* — a new visible form, material, or behavior the player can see change (a paper plane becoming a foil jet; a fan becoming a rocket) — and when at least some upgrades introduce a tradeoff or interact with each other (more thrust burns fuel faster; a bigger tank vs. a stronger engine) rather than being pure power. Build the arc toward an earned peak, not an empty wall after the first few.
- **Advancement must be DRAMATICALLY legible, and EARNED.** When the player crosses a real milestone (a new age/tier/evolution/level), the change has to be unmistakable at a glance — a big, obvious visual leap (a genuine fidelity/style jump in the avatar or world, a clear flourish/announcement), never a subtle tweak the player has to squint to notice. And pace the big milestones so they feel *earned*: keep the first steps accessible (to hook), but a major advance should take real effort and time, not arrive trivially fast — the climb is the reward, so don't give it away.
- **Give progression a long, generous tail.** A short arc that caps quickly kills the endless chase. Extend the upgrade ladder well past the completion goal toward a far aspirational ceiling that keeps mastery players climbing (the goal is where the story resolves; the tail is where the flex lives). High tiers can unlock genuinely new capabilities — a new movement option, an offensive ability, a whole new tool — not just bigger numbers, as long as the first tiers stay cheap, legible, and one-more-run away. Scale the far target to the fantasy: let the ceiling feel almost unreachable.
- **Give the player a choice of where/when to act** among competing options (which threat to clear, which route to take, which pickup is worth the risk) so the decision is spatial/temporal, not just timing.
- **Make progress felt CONSTANTLY, not just at milestones.** Between the big earned advances, keep a steady drip of small, visible gains — a score/size/distance number ticking up, coins accruing, frequent little unlocks — so the player *always* feels they're getting somewhere on a moment-to-moment basis. Big milestones are the punctuation; the constant small gains are the sentence. A game that only rewards you rarely feels flat even if the milestones are great.
- **Progression is the most broadly applicable fun amplifier — and it works because it's simple, not complex.** A clear, legible escalating ladder (rock → pistol → shotgun → machine gun; sapling → tree → forest; bigger, faster, further) layered onto almost any verb makes it more fun, and the joy is in the *readable climb*, not in mechanical depth. The player should grasp the whole ladder at a glance. Reach for a simpler, more legible progression over a clever one; add complexity only when it clearly earns its keep. (Progression is not mandatory — pure arcade, reflex, and toy games shine without it — but when a game feels flat, a simple ladder is the first thing to try.)

These deepen a verb; they never replace the two laws above.

- **Fun-drive dials (the load-bearing decision):** research across the top-22 flash games shows three orthogonal drives — **comedy/spectacle** (fun = what happens on screen; failure is content — Happy Wheels, QWOP, Crush the Castle), **mastery** (fun = getting better; cheap honest retries — Meat Boy, Helicopter Game, Winterbells), and **progression** (fun = numbers going up; every run banks something — Motherload, Learn to Fly, Duck Life). The brief declares a blend (hybrids are the strongest performers) and everything downstream — failure model, difficulty, judging — follows from it.
- **Concept & core verb:** one verb, describable in ≤5 words, legible within 5 seconds of play. Depth comes from the verb's *consequences*, not from more verbs.
- **The twist:** what makes this game not the generic archetype (anti-samey requirement; freeform feeds converge on ~15 clones without this). Theme is a free multiplier — a specific, absurd, or charming premise ("penguin declares war on iceberg") does the work of narrative and meme-ability at once. Constraint breeds identity: mutate the constraint (one button, one lane, four keys), not the asset count.
- **Failure model (per the dials):** failure must be cheap AND interesting — pick at least one: instant zero-cost retry (mastery), failure-as-spectacle where losing is entertaining (comedy — deliberate floppiness/destruction counts), or bank-every-attempt where no run earns zero (progression: launch→earn→upgrade loops guarantee victory through persistence). Boring failure is the only forbidden outcome.
- **Structure & escalation:** session quantum 30s–5min with a "one more" seam (run/wave/level/day ends on a cliff). Escalation delivered as *visible spectacle* (bigger pops, denser waves, further flights), not just harder numbers. A risk/reward layer where it fits (optional danger that pays — gold near hazards, exposed pickups, doubling bonuses). One legible brag number, always visible (score, distance, depth, wave, days).
- **Toy check:** if the concept is physics/sandbox-flavored, the core interaction must be amusing with zero goals (the Line Rider / Tower of Goo test) — goals are garnish on a good toy. Physics is free content: chain reactions, wobble, collapse, and ragdolls generate authored-feeling drama from a few rules; tuning constants (restitution, damping, gravity) are the risk surface and get explicit values in the brief.
- **Physics is a thing you PROVE, not hope.** The most common way a generated game fails is broken or un-fun physics: it flies forever and never ends, the level is unwinnable, the sled dies instantly, the body tunnels/freezes/explodes. When a game has simulated motion, the brief must state how the run TERMINATES (a real end/goal/death — no unbounded fly-forever), that the goal is CLEARABLE by skilled play, and that the feel is FORGIVING (fun, not brittle). The builder must implement it so, and the play-tester must *demonstrate* a run reaching an end and the goal being achievable — never assume the constants are right. Design the physics to be winnable and self-terminating from the start; a beautiful game with broken physics is a failed game.
- **Mode:** single-player (leaderboard) or party (≤8, Playroom) — declared here, wired later
- **Art direction:** palette (specific hexes), shape language, typography, motion style. No engine-default fonts, no placeholder gray. Cohesion over detail — readable cartoon/minimalist aesthetics beat cluttered realism (juice over fidelity).
- **Sound & juice plan:** which events get which feedback channels (see rubric) — juice decides who wins; Crush the Castle vs Angry Birds proves mechanics are copyable and presentation captures the value
- **Controls:** desktop mapping + touch mapping (touch is required; declare portrait/landscape/both). Sparse high-leverage inputs are a legitimate design (one aimed launch + one optional mid-air button beats complex controls for casual players).
- **Rendering route:** pure Canvas2D + WebAudio preferred (smallest failure surface); Phaser 3 only when the concept is genuinely physics-heavy; three.js only when it truly needs 3D (3D multiplies failure modes)

**Ambiguity:** there is no one to ask at build time — when the prompt is ambiguous on mode, feel, or vibe, choose excellent, opinionated defaults and declare them in the brief.

## Stage 2 — Build (the creator's second job, same context)

Writes **one self-contained `index.html`** (inline JS/CSS; assets generated as code/SVG/data-URIs or drawn procedurally). No platform SDK. Constraints:

- **Pinned CDN whitelist** only: Phaser 3.x (exact pinned version), three.js (exact pinned rXXX), Playroom Kit, one sound library (Howler or Tone). Pinning matters: LLM training data is version-skewed (Phaser 4 shipped Apr 2026 but corpora are Phaser 3; see `research/framework-infra.md` §1).
- **`CONVENTIONS.md` injected into context** — the contract the judges enforce. Contents: the full quality rubric; keyboard+touch input requirement with virtual joystick/button patterns; fixed virtual resolution + fit/letterbox scaling snippet; score-POST contract (`POST /api/score` with per-game key); challenge-param convention (`?c=<score>` → render "TARGET" during play); Playroom room contract for party mode; performance budget (<8MB total, playable <3s, 60fps target); seeded-RNG preference.
- Implements its own brief; the brief on disk stays the truthful promise the judge scores against. Silent drift between brief and game is a judge-visible failure.
- **Playtests its own work before handing over:** the creator drives the playtest tool (below) with the controls its game actually uses, LOOKS at the screenshots, and iterates — up to 6 tool calls, with an explicit ship-when-fun stop condition so a strong model doesn't over-polish.

## Stage 3 — Verify loop (evidence, then judgment)

- **The playtest tool (not a persona):** `scripts/playtest-mcp.mjs`, an MCP server both agents drive. Each call boots the game in real Chromium (desktop 1280x720 or iPhone 13 emulation), performs the AGENT-SPECIFIED action list — keys, taps, drags, holds, waits; every game's controls differ, so there is no generic script — and returns console errors, platform-bridge messages (`ready`/score/`gameover`), score progression, and screenshots the agent then reads. A long observe window lets an agent *witness* a run terminating instead of inferring it from physics constants.
- **Smoke gate (deterministic):** `scripts/verify-game.mjs` — loads on both viewports, zero console errors, `gs:'ready'` fires. Objective, cheap, and a hard publish gate no judge can waive.
- **Judge panel** (one pass: feel · taste · fun-drive · integration · content — see `03-quality-rubric.md` for critical-fail rules) plays the game ITSELF via the playtest tool, reads the code, and looks at every screenshot — the creator's and its own. Verdict from evidence only, default-fail when evidence is missing. It emits a score, critical fails, and a critique written as an ordered fixlist to the creator.
- **Iteration:** fail → fixlist goes back to the creator → Edit-in-place fixes + mandatory re-playtest → re-verify. **Cycle budget: 3 full cycles per generation.** Exhausted budget → game is not published; creator sees the critique and can re-prompt.
- **Golden-set calibration:** before launch, hand-build reference games spanning the archetypes (mastery, progression launcher, comedy/spectacle, toy, party — see `03-quality-rubric.md` calibration protocol) that must pass, and deliberately broken/bland ones that must fail. Re-run on every judge-prompt change. Judge drift is a silent product-killer.

## Multi-turn editing

An edit prompt goes to the same creator agent with the existing game in its working dir: it amends `DESIGN_BRIEF.md` (not a rewrite), patches `index.html` in place, re-playtests, and the judge verifies as usual on the same slug. Previous version stays live until the new one passes — **regressions never ship**, which fixes the "prompt roulette breaks working games" failure every competitor has.

## Cost model

Cost of goods per published game = (creator + judge) × cycles, plus the creator's playtest tool calls (browser-only, no model spend). This is the number that decides viability — benchmark it in Phase 0 before building the site (see `06-roadmap.md`). Levers: cycle budget, playtest-call budget, model tier + reasoning effort per role (`GS_MODEL_CREATOR/JUDGE`, `GS_EFFORT_CREATOR/JUDGE` — creator high, judge medium), daily quota.
