# Launch Watch

Daily snapshot of the public gamecraft.gg library and credited makers, taken from public HTTP only (no DB/Fly CLI access). Used to spot new creators, disappearing games, and site health issues over time.

## 2026-10-18

- Site health: `/`, `/login`, `/makers`, and `play.gamecraft.gg/play/paper-pilot` all returned 200.
- Games live on feed: 23
- Makers credited on feed: 10

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

- No change vs. the 2026-10-17 snapshot (PR #65, branch `launch-watch-2026-10-17`): identical game list and identical maker list, day-over-day.
- Retired games `green-thumb` and `rattlesnake-noon` were confirmed NOT present on the feed (expected — they were deliberately retired before launch).
- Process issue: `LAUNCH_WATCH.md` has never actually been merged to `main`. There are ~45 daily `launch-watch-*` PRs open and unmerged going back to 2026-07-27 (most recently #65, #64, #63...), so every run has had to reconstruct yesterday's snapshot from the most recent open branch instead of diffing against a real file in the repo. Worth merging one of these PRs and closing the rest so this file becomes a real persistent record.
- Limitation: signups, plays, score submissions, and credit purchases live in the production database and are not visible from public HTTP, so this snapshot covers the public library and site health only.
