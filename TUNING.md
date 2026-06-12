# CLOSEOUT — Tuning Notes

How to balance-patch `closeout.html` with one-line edits. All line references are to
named constants/tables — search for the string, don't trust line numbers.

## Playtest observations (June 2026, pre-ship)

Testing was done two ways: scripted full-run simulations of the complete game loop
(bot players at three skill levels, multiple trials each), plus the in-browser debug
key for the performance gate. Observed difficulty band:

- **Panic player** (stands still / moves randomly): dies in NOV (month 1-2). The CR
  window is usually the first wall. This is intended — it teaches "you must move."
- **Decent player** (kites, grabs gems, sane card picks): dies APR–JUN (months 6-8)
  around level 18-25, ~$600K–$1.4M obligated. GAO PROTEST gets killed; first IG AUDIT
  is usually survivable; Q3 attrition is what ends the run.
- **Strong player** (kites wide, dodges AUDIT FINDING lobs, prioritizes AoE):
  reaches SEPTEMBER most runs and wins some of them. One sim win ended at
  $3.3M / 4,300 kills. The September finale is supposed to feel like a coin you
  earned, not a freebie.

Score pacing (verified): $15K crosses at ~65–75s (mid-NOV), $350K at ~5:00 (FEB-MAR).
Both banners fire mid-action and don't block.

Known intentional quirks:
- Kill dollars scale with the month (`1+G.month*0.35`) — late-year kills are worth
  more, which is what pushes the SAT banner to mid-run and makes Q4 feel lucrative.
- GAO PROTEST freezes spawn escalation for at most 75s — without the cap, a player
  who refuses to fight it could freeze the whole year (found in sim, fixed).
- The enemy pool saturating at 400 IS the fail state: if the field caps, the player's
  DPS has already lost the year and the horde closes in.

## Where every magic number lives (all in closeout.html)

| Knob | Search for | Notes |
|---|---|---|
| Month length / run length | `MONTH_S=65` | 65s × 12 = 13 min run |
| Pool caps | `CAP_E=400, CAP_P=600` | enemies/projectiles/particles/gems caps |
| Spawn tables per month | `MONTH_CFG=[` | `int` = seconds between ticks, `batch` = spawns per tick, `mix` = type weights. One row per fiscal month |
| Enemy base stats | `ETYPES={` | hp/spd/dmg/r/val($)/xp per family |
| Enemy HP scaling | `function hpMul` | `1+m*0.30` per month |
| Enemy contact damage scaling | `function dmgMul` | `1+m*0.05` |
| Enemy speed scaling | `function spdMul` | `1+m*0.028` |
| Kill dollar scaling | `D.val*(1+G.month*0.35)` | in `killEnemy` |
| Threshold banners | `checkThresholds` | $15,000 and $350,000 triggers |
| Weapon stat tables | `WEAPONS={` | cd/dmg per level (arrays indexed lvl-1), one object per weapon |
| Evolution stats | `EVOS={` | IDIQ orbs, SF-44 fan |
| Passive per-level effects | `statDmg/statCd/statMagnet/statXp/statSpd/statMaxHp/statRegen` | one function each |
| XP curve | `P.xpNext=floor(8+P.level*5)` | in `gainXp` (and initial `xpNext=13` in startRun) |
| Player base speed | `return 150*` | in `statSpd` |
| Base magnet radius | `return 90+35*` | in `statMagnet` |
| Player iframes | `P.iframe=.6` | in `hurtPlayer` |
| CR event timing | `G.t>=75` and `G.crT=50` | start (s) and duration (s), in `updDirector` |
| GAO boss timing | `MONTH_S*5.5` | mid-MAR |
| GAO escalation freeze cap | `G.gaoT+75` | seconds |
| IG AUDIT timings | `MONTH_S*6.6` / `MONTH_S*8.4` | two minibosses, Q3 |
| September surge | `G.surgeT=14` and `n=min(22,` | period and wave size |
| SEPT 30 spawn | `RUN_S-45` | 45s before midnight |
| UC elite cadence | `G.t+28+rng(0,10)` | from month 4 (FEB) |
| Character stats | `CHARS=[` | hp/spd/palt/start weapon/unlock |
| Chest reward logic | `chestResult` | evo > free upgrade > $25K |
| Chest heal | `P.hp+40` in `updChests` | heal on pickup |
| AAR tip lines | `TIPS=[` | rotating field notes |

## Suggested first dials if players complain

- "Too hard in Q3/Q4" → `hpMul` 0.30 → 0.27, or AUDIT FINDING `dmg:8` → 6.
- "Too easy once built" → `MONTH_CFG` SEP `int:0.26` → 0.22, surge `G.surgeT=14` → 12.
- "Leveling feels slow" → XP curve `8+P.level*5` → `7+P.level*4`.
- "September is a wall" → SEPT 30 spawn `RUN_S-45` → `RUN_S-35`, surge size 22 → 18.
- "Evolutions never happen" → they require a MAX (L5) weapon + its paired passive
  (PO+WARRANT → IDIQ, GPC+PALT → SF-44) at a boss chest. Three chests per run
  (GAO + 2 IG). To loosen, change `w.lvl>=MAXLVL` in `chestResult` to `>=4`.

## Performance

Perf gate: tilde (`) in a run spawns 400 dummies + 400 projectiles and shows FPS +
live pool counts. Engine-side frame cost at that density measured ~0.16ms/frame in
simulation (logic + draw-call dispatch). All glow is pre-rendered to offscreen
sprites at boot — if you add an enemy type, add its sprite in `buildSprites()` and
never use `shadowBlur` inside the frame loop. Cut `CAP_PT` (particles) first if a
device struggles; never cut `CAP_E` first.

---

# PATCH 1 ADDITIONS (June 2026)

## Patch playtest observations

Re-ran the scripted full-run sims on the patched build (smart-bot, multiple trials):
Office band unchanged — strong play reaches month 9+, decent play dies Q3, careless
play dies in NOV. **THE FOB is intentionally harder** (strong bot died MAR): heavier
EXPIRED FUNDS mix (30% of UR spawns convert), UNAUTHORIZED COMMITMENT elites every
~17s instead of ~28s. It's the reward map for players who already survived to July.
FOB threshold banners use the verified contingency OCONUS values from FAR 2.101
(checked at acquisition.gov 2026-06-11): **MPT $40,000 / SAT $2,000,000**
(standard map keeps $15K / $350K). Engine perf gate after the full patch:
p50 0.26ms/frame logic+dispatch at 400 enemies + 400 projectiles, both maps.

## New magic-number locations

| Knob | Search for | Notes |
|---|---|---|
| Pixel sprite data | `PXDATA=` | rows of palette chars; `PXPAL` is the palette; scale/glow in `buildPxSprite` (sc=3, shadowBlur 9) |
| Floor tiles | `buildFloors` | 192px repeating tiles, one per map |
| Prop placement | `PROP_CELL=300` and `propAt` | `(h&7)>=3` controls density (3/8 of cells); spawn-clear radius 260 |
| Map defs + thresholds | `MAPS={` | per-map props, pickups, mpt/sat values + banner copy |
| FOB enemy skew | `rnd()<.3)ty='expired'` in `pickType`; UC cadence `'fob'?17:28` | |
| Pickup cadence | `G.pickT=16+rng(0,8)` and `spawnPick` (max 3 live, bulk 20%) | effects in `PICKFX` |
| Speed-boost pickups | `P.boostT>0?1.4:1` in `statSpd`, 5s duration in `PICKFX` | |
| New weapon tables | `r2:`, `cor:`, `ra:`, `deb:` in `WEAPONS` | same level-array format |
| All evolution numbers | `EVOS={` | every ultimate's stats + `eff` codex line |
| GFP reduction | `dmg-2*psvLvl('gfp')` in `hurtPlayer` | |
| EA revive | `G.eaUsed` block in `hurtPlayer` (50% HP, 280px clear, 2s iframes) | |
| Character innates | `'ko'?1.12` (statDmg), `'civ'?1.15` (statXp), supt aura `GRID.query(P.x,P.y,130` + `sp*=.7` | |
| Character unlocks | endRun: `G.dollars>=1000000` (KO), office win (CIV), `lifeDollars>=100000000` (SUPT) | |
| Music patterns | `MUS.TRACKS` | 32-step arrays, MIDI note numbers, 0=rest; bpm per track |
| Music layering | `MUS.layers()` | drums Q2 (`month>=3`), arp Q3, high lead Q4, `bpmMul 1.18` in SEP |
| Music volume | `this.gain.gain.value=.30` in `MUS.ensure` | SFX master 0.5 in `AU.init` |
| Leaderboard qualify floor | `G.dollars>=15000` in endRun | runs below the MPT don't get initials entry |
| Profanity blocklist | `PROFANE=[` | |
| Card delta lines | `stat:` per weapon, `PSTAT` per passive | NOW/NEXT strings |
| Armory discovery | `seen` / `addSeen` (key `farcade_co_seen`) | ??? until encountered |
| Save schema | `migrate()` — currently v4 | bump + add a branch for any future key change |

## Leaderboard backend

`farcade-leaderboard-worker.js` is now v4: board id `closeout` accepted, score cap
$25M, one POST writes daily + weekly + all-time (KV keys `daily:<date>:closeout`,
`week:<isoweek>:closeout`, `closeout`), sort tiebreaks by months then time survived.
**Until the v4 worker is re-pasted into Cloudflare (see FARCADE-LEADERBOARD-SETUP.md),
the live v3 worker rejects closeout posts and the game shows LOCAL boards — that
degradation is by design and play is never blocked.**
