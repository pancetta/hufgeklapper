# Economy run

A headless run of the Sim checks the balance (`src/sim/economy.ts`, issue #18). It plays 40 days from a new game on
five fixed seeds with three simple strategies, using only actions a child has. In jumping rounds a pole falls one time
in five on a new pony, less often the wider the horse's take-off window (skill and care, as in the minigame).

- **careful**: buys hay ahead, cares for every horse every day, gives every lesson, practises for the badge, rides
  every show; at the Reitschule builds stall places, buys the cheapest horse and upgrades the arena when the money allows.
- **careless**: buys hay only when it is gone and cares only every third day; gives lessons, rides shows, never builds.
- **sport**: like careful, but jumping first: practises every day after the badge and gives only one lesson a day
  until a third horse is there.

`npm test` checks the targets of #18 on every push (well under a second); `npm run economy` prints the table below.

| Target (#18) | Status |
|---|---|
| A careful player reaches the first farm inspection in about 10–15 days (median of the seeds) | met: day 11–12 |
| A careless player never gets stuck (all horses sick, no money for the vet, no more loans) | met |
| No single strategy is clearly best | **not met** (open, `it.todo` in the test) |

## Current numbers

Sick days are counted in the morning, before the vet comes.

| Spielweise | Seed | Geld Tag 10 | Geld Tag 20 | Geld am Ende | Reitabzeichen (Tag) | Hof-Prüfung (Tag) | Reitstunden | Turniere | Kranktage | höchste Schulden | festgefahren |
|---|---|---|---|---|---|---|---|---|---|---|---|
| careful | 1 | 623 € | 490 € | 706 € | 3 | 11 | 117 | 12 | 0 | 0 € | nein |
| careful | 2 | 701 € | 359 € | 1196 € | 3 | 12 | 126 | 12 | 0 | 0 € | nein |
| careful | 3 | 673 € | 199 € | 836 € | 3 | 11 | 120 | 11 | 0 | 0 € | nein |
| careful | 4 | 587 € | 243 € | 1037 € | 3 | 11 | 122 | 12 | 0 | 0 € | nein |
| careful | 5 | 645 € | 286 € | 1054 € | 5 | 12 | 122 | 12 | 0 | 0 € | nein |
| careless | 1 | 485 € | 450 € | 251 € | 3 | – | 39 | 10 | 14 | 0 € | nein |
| careless | 2 | 551 € | 522 € | 416 € | 3 | – | 41 | 10 | 14 | 0 € | nein |
| careless | 3 | 499 € | 422 € | 275 € | 3 | 18 | 41 | 10 | 14 | 0 € | nein |
| careless | 4 | 406 € | 240 € | 29 € | 3 | – | 30 | 10 | 14 | 100 € | nein |
| careless | 5 | 508 € | 514 € | 475 € | 5 | 21 | 45 | 9 | 14 | 0 € | nein |
| sport | 1 | 396 € | 439 € | 353 € | 3 | 25 | 40 | 13 | 0 | 0 € | nein |
| sport | 2 | 406 € | 487 € | 334 € | 3 | 25 | 48 | 13 | 0 | 0 € | nein |
| sport | 3 | 384 € | 470 € | 170 € | 3 | 25 | 40 | 13 | 0 | 0 € | nein |
| sport | 4 | 429 € | 520 € | 460 € | 3 | 25 | 64 | 13 | 0 | 0 € | nein |
| sport | 5 | 382 € | 424 € | 340 € | 5 | 32 | 40 | 12 | 0 | 0 € | nein |

## What changed because of it

- The first run had the inspection on day 4–6: the Kleiner Hof's goals were too small. Now 25 lessons (was 5),
  500 € saved (was 400) and reputation 60 (was 50). Horse energy (−30 a lesson, +40 a night, about 2.3 lessons a day
  with two ponies) is what paces the lessons, so the lesson goal sets the inspection day: about 2–4 play sessions.

## Open points

- **Careful is clearly best.** It gives lessons *and* rides shows; practice earns nothing by itself, and there is no
  time budget that would make lessons and sport compete. The sport player ends with about a third of careful's money
  and reaches the inspection only on day 25–32. Making sport a real choice is a design decision, for example: show
  classes with bigger prizes that only well-trained horses may enter, or advanced pupils paying more on a skilled horse.
- **Careless gets nowhere slowly.** About 14 sick days in 40 (a pony falls sick every few days and rests after the
  vet), so fewer lessons and a lower reputation: the inspection comes on day 18–21 or not within 40 days (3 of 5 seeds).
  Never stuck, but a child who neglects the ponies may wait long; Oma Hanne's hints are meant to catch that.
- The riding badge comes on day 3–5 for every strategy; it could ask for more practice.
