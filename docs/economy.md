# Economy run

A headless run of the Sim checks the balance (`src/sim/economy.ts`, issue #18). It plays 40 days from a new game on
five fixed seeds with three simple strategies, using only actions a child has. In jumping rounds a pole falls one time
in five on a new pony, less often the wider the horse's take-off window (skill and care, as in the minigame).

- **careful**: buys hay ahead, cares for every horse every day, gives every lesson, practises for the badge, rides
  every show (like every strategy, in the highest class its best horse may start in); at the Reitschule builds stall places, buys the cheapest horse and upgrades the arena when the money allows.
- **careless**: buys hay only when it is gone and cares only every third day; gives lessons, rides shows, never builds.
- **sport**: like careful, but jumping first: practises every day with its best jumper after the badge, so that horse
  grows into classes A and L, and gives only one lesson a day until a third horse is there.

The farm's worth ("Hof-Wert") is money minus debt plus what was spent on horses and building: a player who built
the arena is not poorer for it.

`npm test` checks the targets of #18 on every push (well under a second); `npm run economy` prints the table below.

| Target (#18) | Status |
|---|---|
| A careful player reaches the first farm inspection in about 10–15 days (median of the seeds) | met: day 11–12 |
| A careless player never gets stuck (all horses sick, no money for the vet, no more loans) | met |
| No single strategy is clearly best | met: careful and sport each end with the more valuable farm on some seeds, medians 2050 € and 2146 €; careful reaches the Reitschule on day 11–12, sport on day 25 |

## Current numbers

Sick days are counted in the morning, before the vet comes.

| Spielweise | Seed | Geld Tag 10 | Geld Tag 20 | Geld am Ende | Hof-Wert am Ende | Reitabzeichen (Tag) | Hof-Prüfung (Tag) | Reitstunden | Turniere | Kranktage | höchste Schulden | festgefahren |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| careful | 1 | 623 € | 490 € | 706 € | 1806 € | 3 | 11 | 117 | 12 | 0 | 0 € | nein |
| careful | 2 | 701 € | 359 € | 1216 € | 2226 € | 3 | 12 | 126 | 12 | 0 | 0 € | nein |
| careful | 3 | 673 € | 199 € | 830 € | 1900 € | 3 | 11 | 121 | 11 | 0 | 0 € | nein |
| careful | 4 | 587 € | 243 € | 1037 € | 2087 € | 3 | 11 | 122 | 12 | 0 | 0 € | nein |
| careful | 5 | 670 € | 208 € | 920 € | 2050 € | 5 | 12 | 121 | 12 | 0 | 0 € | nein |
| careless | 1 | 485 € | 450 € | 343 € | 343 € | 3 | – | 43 | 10 | 14 | 0 € | nein |
| careless | 2 | 571 € | 567 € | 459 € | 459 € | 3 | 18 | 40 | 10 | 14 | 0 € | nein |
| careless | 3 | 499 € | 442 € | 295 € | 295 € | 3 | 18 | 41 | 10 | 14 | 0 € | nein |
| careless | 4 | 406 € | 240 € | 29 € | -49 € | 3 | – | 30 | 10 | 14 | 100 € | nein |
| careless | 5 | 508 € | 514 € | 475 € | 475 € | 5 | 21 | 45 | 9 | 14 | 0 € | nein |
| sport | 1 | 421 € | 424 € | 598 € | 1718 € | 3 | 25 | 70 | 13 | 0 | 0 € | nein |
| sport | 2 | 406 € | 642 € | 1056 € | 2146 € | 3 | 25 | 77 | 13 | 0 | 0 € | nein |
| sport | 3 | 384 € | 550 € | 1316 € | 2346 € | 3 | 25 | 77 | 13 | 0 | 0 € | nein |
| sport | 4 | 429 € | 600 € | 2154 € | 3174 € | 3 | 25 | 85 | 13 | 0 | 0 € | nein |
| sport | 5 | 397 € | 484 € | 604 € | 1674 € | 5 | 25 | 59 | 12 | 0 | 0 € | nein |

## What changed because of it

- The first run had the inspection on day 4–6: the Kleiner Hof's goals were too small. Now 25 lessons (was 5),
  500 € saved (was 400) and reputation 60 (was 50). Horse energy (−30 a lesson, +40 a night, about 2.3 lessons a day
  with two ponies) is what paces the lessons, so the lesson goal sets the inspection day: about 2–4 play sessions.

- Careful used to beat sport on every seed: practice earned nothing by itself. Now shows have classes (E, A, L):
  a horse may start in A from jumping skill 40 and in L from 70, with bigger fees, stronger rivals and much bigger
  prizes (first place 60 €, 150 €, 300 €). Practice also brings more skill (+4 for a clear round, +2 with faults;
  was +3 and +1), so daily practice reaches class A in about two weeks. Lower thresholds made sport *worse*: a horse
  starting early meets rivals it can't beat.

## Open points

- **Careless gets nowhere slowly.** About 14 sick days in 40 (a pony falls sick every few days and rests after the
  vet), so fewer lessons and a lower reputation: the inspection comes on day 18–21 or not within 40 days (2 of 5 seeds).
  Never stuck, but a child who neglects the ponies may wait long; Oma Hanne's hints are meant to catch that.
- The riding badge comes on day 3–5 for every strategy; it could ask for more practice.
