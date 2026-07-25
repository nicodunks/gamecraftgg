# GLOWGULP — design brief

> A tiny frog on a lily pad licks fireflies out of the twilight air. Every bug it swallows
> pushes the darkness back a little. Stop eating and the pond goes black.

## Fun-drive dials

**mastery (primary) + progression (strong secondary).**
Mastery: the flick is a skill shot with a threading problem (wasps) and a greed problem (combos);
retries are instant and free. Progression: the frog visibly *grows* through 7 tiers inside a run,
and every run banks lifetime bugs toward permanent Pond Charms — no attempt earns zero.
Comedy is a garnish only (croaks, squishes, an offended wasp), not a driver.

## Core verb (≤5 words)

**Flick tongue at fireflies.** Point, click/tap, the tongue whips out along a straight line,
sticks whatever it touches, and drags it home to be gulped.

Legible in <5s: the aim guide is drawn from the frog's mouth, the fireflies are the only bright
things on screen, and the first click lands a catch.

## The twist

The tongue is a **line, not a cursor.** It always whips out to its *full* length at the angle you
point, and catches *everything it passes through* — so the interesting decision is never "can I
hit that one" but **what line do I want?** Fireflies swarm in loose knots of 2–3, and the ones
currently standing on your line are ringed live (with a `×3 on the line!` call-out), so the
choice is legible without a word of tutorial.

- Two or three fireflies drifting into rough alignment = one flick, ×2/×3/×4 score (10·n²).
- A wasp anywhere on that line = a sting: light lost, tongue stunned, **and every firefly
  already stuck to the tongue escapes.** Greed is punished at exactly the moment it pays most.
- Hopping between 5 lily pads changes the *origin* of every possible line, so movement is a
  real aiming tool, not just dodging — and a hop costs ~0.2s of flick time (a commitment).

And the darkness is both the clock and the art direction: as the glow meter drains, the world
dims to almost nothing, but fireflies still shine. Late in a run you're playing by their light.

## Decisions under pressure (the first law, interrogated honestly)

Every ~0.4s the player answers: *take the safe single bug now, or hold half a second for the
alignment that pays 4× — with a wasp drifting through the lane and the glow meter falling?*
The optimal move is never obvious because the payoff (combo), the risk (wasp on the line,
stuck bugs lost), and the pressure (glow draining, faster every second) all change continuously.
Skill shows in line selection and pad position, not in click speed.

## The second law — the player performs the mechanic every time

Retry rebuilds the real start state: frog on the **center** pad, tongue idle, glow at 62, aim
guide waiting for the player's own point-and-flick. The game never flicks for them, never
pre-aims, and the game-over screen is not a menu — one input and you're aiming again.

## Depth levers used (and deliberately skipped)

- **Metered resource:** glow *is* the resource — it drains every second and is only refilled by
  eating. Every flick is a spend of time against it.
- **Upgrades as transformations with tradeoffs:** each tier is a new drawn frog (see ladder) with
  a **longer tongue and more glow per bug**, but a **slower hop** and a **higher drain rate** —
  a bigger frog needs more light. Stated on the growth banner.
- **Dramatically legible advancement:** tier-up = full-screen ring burst, hit-stop, chord
  arpeggio, banner with the new name, and the frog visibly *scales and changes form* (vocal sac →
  warts → gold speckles → glowing eyes → crown → aura).
- **Constant small progress:** score ticks and pops on every gulp, floating `+90 ×3!`, the
  tier bar creeps every single bug, the glow bar visibly refills.
- **Long generous tail:** tiers 6–7 (POND KING at 64 bugs, GLOWGULP at 100) are far past the
  90-second completion goal — a mastery flex, not a requirement.
- **Spatial choice:** 5 pads × a 170° aim arc = the player chooses *where* to shoot from.
- **Skipped:** shops, currencies, branching builds. One verb, one meter, one ladder.

## Progression ladder (in-run, thresholds in bugs eaten)

| tier | bugs | frog | tongue | glow/bug | hop |
|---|---|---|---|---|---|
| SPRIG | 0 | tiny bright-green sprout | 300 | 3.6 | fast |
| HOPPER | 3 | rounder, stronger legs | 372 | 4.2 | fast |
| CROAKER | 9 | puffed vocal sac | 444 | 4.8 | med |
| BULLFROG | 20 | broad, dark, warty | 520 | 5.6 | med |
| MOONTOAD | 38 | gold speckles, glowing eyes | 600 | 6.6 | slow |
| POND KING | 64 | crown, regal jaw | 690 | 7.8 | slow |
| GLOWGULP | 100 | living lantern, full aura | 780 | 9.0 | slowest |

Tongue lengths (and swarm size) scale ×0.9–1.35 with stage width, so a wide desktop pond plays
at the same difficulty as a phone one. Fireflies spawn in reachable lanes that climb as the frog
grows — the sky's high bugs are a visible carrot for the next tier.

**Cross-run bank (Pond Charms, `gs_save:<slug>`):** 80 lifetime bugs → **Sticky Tongue**
(+35% catch radius); 250 → **Night Eyes** (darkness holds further back); 600 → **Bullfrog Blood**
(start at CROAKER). Shown with a progress bar on every game-over, so no run is wasted.

## Failure model

Cheap **and** interesting, all three channels:
- **Instant retry** — one input, <1s, straight back to aiming.
- **Failure as spectacle** — glow hits 0, the pond snaps to black, the fireflies scatter upward
  and out in a slow shimmer, a long descending croak. Losing looks like nightfall.
- **Banked progress** — lifetime bugs and charm progress persist from every attempt.

## Structure, escalation, termination

- Session: **40s–3min.** Drain starts at 2.8/s and ramps +0.05/s of elapsed time (capped),
  plus 0.30/s per tier. Fireflies get faster and denser; wasps enter at 14s and scale to 4.
- **Completion goal: survive to MOONRISE at 90s.** The moon climbs, glow refills to full, drain
  halves for 12 seconds, +500. It is genuinely clearable — sustaining ~0.8 bugs/s does it — and
  then night deepens again for the endless tail.
- **Termination is guaranteed by construction:** drain only ever ramps up while glow is capped at
  100, so an idle or overwhelmed player reaches 0 in ~22s. There is no fly-forever state.
- "One more" seam: game-over shows the tier you *almost* reached and the charm bar inches along.
- One brag number: **GLOW** (score), always top-right, animated on change.

## Motion / feel (no heavy sim, so Canvas2D — not Phaser)

Kinematic, not rigid-body: tongue extends at 1650–2010 px/s and retracts ~1.24× faster, always to
full tier reach (uniform cadence, angle-only aim); catch test is a **point-to-segment** distance
(radius 17+9·size) against the swept segment (prev tip → new tip), so nothing tunnels at any speed. Fireflies drift
on summed sines inside a band and steer off the edges — no explosions, no freezes, no
unwinnable state. Hop is a 190–360ms parabolic arc with squash/stretch. Input→response is
same-frame.

## Art direction

Storybook dusk. Rounded blob shapes, no hard corners, soft glows over flat fills.

Palette: pond night `#0B1026` · dusk indigo `#2A2F6B` · horizon ember `#F2A65A` ·
water `#10265A` / `#071230` · pad green `#2F8F5B` / `#46B473` · frog `#8FE06A` → `#2E8B57`
belly `#F7F3D0` · firefly `#FFE873` / `#FFF6C9` · golden `#FFB627` · wasp `#E8654F` /
`#2B1B10` · cream text `#FDF6E3` · letterbox `#05070F`.

Type: `"Comic Neue", "Chalkboard SE", "Segoe Print", sans-serif` — hand-lettered storybook.
Everything drawn in code: gradients, glows, cattail reeds, ripples, seeded starfield.

## Sound & juice plan (≥2 channels on every core interaction)

| event | sound | visual |
|---|---|---|
| flick | airy whip, noise sweep, ±10% pitch | tongue whip, mouth open, guide flash |
| stick | short wet click, pitch by combo index | firefly squish, sparks, bug rides the tip |
| gulp | descending sine "glop" | score pop, `+n ×k!` float, glow bar surge, throat bulge |
| combo ≥2 | rising triangle arpeggio | ring burst, shake `min(n,4)·1.6px`, big combo text |
| wasp sting | harsh saw buzz + noise | red flash, shake, stuck bugs flee, tongue snaps back |
| golden bug | bell | gold sparkle trail, bigger ring |
| tier up | maj-chord arpeggio | hit-stop, ring, frog scales with overshoot, banner |
| moonrise | soft pad chord | moon climbs, sky lifts, banner, glow refill sweep |
| hop | short croak, pitch by tier | pad dip, ripple ring, arc squash |
| low glow (<20) | slow heartbeat | vignette flicker, bar pulses red |
| game over | long descending croak | pond snaps black, fireflies scatter, cards ease in |

Nothing pops in: spawns fade+scale in, UI eases, banners slide.

## Controls

**Desktop:** move mouse to aim (guide follows) · **click or hold** to flick — holding auto-repeats
at the tongue's natural cadence · **A/D or ←/→** to hop pads · Space also flicks · Enter/Space
retries.

**Touch (`pointer: coarse`, both orientations):** finger position *is* the aim (direct) —
**tap or hold anywhere in the sky/pond** to flick and repeat · two persistent, drawn, labeled
buttons **`◀ HOP`** / **`HOP ▶`** in the bottom thumb zones (never invisible, never fading).
Tested mentally at 390×844 and 844×390; the virtual stage is height-locked at 900 with width
following the aspect (clamped 520–1500), so both orientations get a real layout, not a strip.

First-time clarity: one in-world hint line for aim/flick + hop, self-dismissing after 9s or 3
catches; a one-line "don't lick the WASPS" the first time a wasp appears; a "GOLDEN — big glow!"
the first time a golden bug spawns. No walls, no menus.

## Rendering route

**Canvas2D + WebAudio, single file, no libraries.** The motion is kinematic and the art is
hand-drawn vector — Phaser would add weight and failure modes for nothing.

## Platform contract

`ready` on load · `score` throttled at 300ms · `gameover {score}` at every pond-blackout ·
`?c=N` renders a persistent styled **TARGET** and fires `challenge_beaten` with a celebration ·
best in `gs_best:<slug>`, charms in `gs_save:<slug>`, slug derived from the URL (remix-safe) ·
single leaderboard: **glow**, descending.
