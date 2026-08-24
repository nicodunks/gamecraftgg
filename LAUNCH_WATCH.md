# Launch Watch

Daily public-HTTP snapshot of the gamecraft.gg game feed and credited makers, taken from https://gamecraft.gg/. Used to spot new/disappeared games and new creators day over day.

## 2026-08-24

- Site health: `/`, `/login`, `/makers` all 200. `play.gamecraft.gg/play/paper-pilot` 200 (following redirects).
- Games live on feed: **23**
- Makers credited on cards: **10**

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

- `LAUNCH_WATCH.md` still does not exist on `main` — this repo has 19 prior "launch watch snapshot" PRs (2026-07-27 through 2026-08-23), all opened and none merged, so no snapshot has ever actually landed. This PR is the 20th attempt at the same baseline commit.
- Compared against the most recent unmerged snapshot (branch `launch-watch-2026-08-23`, dated 2026-08-23): the game list and maker list are byte-for-byte identical to today's — same 23 games, same 10 makers, no new entries and no disappearances in the 1 day since (and no changes at all in the 6 days since 2026-08-18).
- No games have reappeared from the retired list. Retired games `green-thumb` and `rattlesnake-noon` are NOT present on the feed — no regression.
- Per known prior context (not from this file): as of 2026-07-26 the site had 20 published games and 7 credited makers, 4 of them organic (MightyPirate40, DoodleBadger90, PixelBandit63, DoodlePirate42) — all 4 are still present today.
- Signups, plays, score submissions, and credit purchases live in the production database and are not visible from public HTTP; this file covers the public library and site health only.
