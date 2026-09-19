# Cradle to Grave — playtest handoff

This is the first playable milestone from the supplied September 17 blueprint. Open `index.html` directly; there is no server, installation, build step, account, or network dependency. The other files document testing.

## What is implemented

- Both deployed and stateside settings, all 14 spine positions, and the alternate sole-source negotiation card.
- Conditional routing: the sole-source route replaces D7/D8 with D7-SS; priced surge makes D11 an automatic callback. A run therefore contains 12–14 player decisions, not always 14.
- Exact blueprint meter effects, flags, timing adjustments, severe overrides, five endings, and named callbacks.
- More plausible choice wording, similar visual treatment, and stable randomized presentation order within each run. No correct/incorrect labels during play.
- Free advice, one-card layout, persistent status, a post-award timeline, and 1/2/3 + Enter keyboard controls.
- Automatic device-local save with safe recovery, three-part debrief, replay and alternate-setting buttons, and optional print/PDF supervisor discussion.
- `?debug=1` shows flags, meter overrides, a card selector, and the complete-path simulation. Debug state never replaces the normal save. `simulate()` is also available in the console.

## Deliberate playtest boundaries

- Placeholder artwork is intentional, following the blueprint’s build order. All 32 assets have paths and alt descriptions in `SCENARIO.images`; no missing images are requested.
- References remain empty and unvalidated. They appear only in the file review. Nick validates them before public release.
- The game is not linked from the live homepage or training index, and the existing hosted Execution Lab is unchanged.
- Vendor-name screening and cold playtests are still release gates.

## Rules resolved without changing the blueprint

- The D9 choice happens first, then the protest callback subtracts five days once if either trigger is present, then the award timing rule is applied. This follows the order of the event definitions in section 7.
- D11 records a callback when surge is priced, so the debrief still shows the growth outcome.
- D12 government-cause wording uses gate delays when deployed and badge delays stateside; the meter effects are identical.
- Severe flags do not interrupt play.
- Advice never modifies meters or the ending.

## Verification

`node tests/execution-lab.test.mjs` checks conditional D12/D13 effects, both paths, severe endings, single protest timing, delayed callbacks, restoration at every event position, and parity between interactive and simulation reducers.

`node tests/execution-lab.test.mjs --balance` additionally enumerates every reachable path in both settings and writes `balance-results.json`.

| Setting | Complete paths | Severe paths | Trusted Advisor* | Mission Hacker* | Paper Shield* | Lessons Learned* |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| dep | 2,066,715 | 1,331,883 | 15.39% | 15.06% | 29.25% | 40.29% |
| st | 2,066,715 | 1,331,883 | 15.95% | 15.28% | 28.69% | 40.08% |

*Percentages are among paths without a severe flag, matching the blueprint denominator. Enumeration weights each complete path once; it is not a forecast of human behavior.

Balanced-route award clock: deployed +2 days; stateside +4 days.

Browser QA: the local server is not reachable from the connected cloud browser, so no claim of live browser or device testing is made. Responsive styles and functional behavior have been checked in source and headless tests.

## Playtest request

Play each setting three times. Note the card title and choice whenever something feels fake, obvious, slow, or unfair. Try one balanced run, one urgent run, and one cautious run. The next pass is wording adjustments based on those observations, then illustrations.

## Editing contract

All scenario prose, numbers, conditional outcomes, endings, tokens, references, and asset metadata live in the `SCENARIO` object at the start of the inline script. Engine and renderer follow clearly marked boundaries. Keep content changes in that object.
