# GameCraft Launch Watch

Daily snapshot of the public game library and credited makers on gamecraft.gg,
gathered from public HTTP only (no database/Fly CLI access).

## 2026-09-30

- Site health: `/`, `/login`, `/makers`, and `play.gamecraft.gg/play/paper-pilot` all returned 200.
- Games live: 23
- Makers credited: 10

### Games (23)

- bullseye-bender
- coin-cyclone
- cozy-cove
- deadeye
- flap-happens
- glowgulp-pond
- inkwell
- ironhull
- kettle-kosmonaut
- lee-shore-lantern
- microbe-bloom
- numberwyrm
- paper-pilot
- pocket-apocalypse
- rip-entry
- shoutling
- sky-duel
- skylark-bay
- standstill-firefight
- stick-front
- sweaty-palms
- the-longest-night
- tidewright

### Makers (10)

- DizzyBadger57
- DoodleBadger90
- DoodlePirate42
- LuckyGoblin28
- LuckyPirate87
- LuckyYeti80
- MightyPirate40
- PixelBandit63
- WobblyMoth34
- ZippyYeti85

### Notes

- No change vs. the last recorded snapshot: `LAUNCH_WATCH.md` is not on
  `main` (see process note below), but the most recent prior snapshot
  branch, `launch-watch-2026-09-29`, recorded the identical 23-game and
  10-maker lists. Zero games added, zero games removed, zero makers
  added, zero makers removed since that run.
- Retired games `green-thumb` and `rattlesnake-noon` were checked for and
  are **not** present in today's feed (expected).
- All four organic launch-week makers (MightyPirate40, DoodleBadger90,
  PixelBandit63, DoodlePirate42) are still present.
- **Process note:** none of the daily `launch-watch-*` PRs opened by this
  routine appear to have ever been merged to `main` (checked ~40 prior
  branches going back to 2026-07-27). Every branch, including this one,
  is cut directly from `main` and so starts with no history of its own —
  the only continuity between runs currently lives in unmerged git
  branches, not in a file on `main`. If day-over-day tracking in this file
  is meant to be authoritative, one of these PRs needs to actually be
  merged.
- Signups, plays, score submissions, and credit purchases live in the
  production database and are not visible from public HTTP; this snapshot
  covers the public library and site health only.
