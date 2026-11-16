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
| No single strategy is clearly best | met: on ten seeds, sport's median farm worth is 0.91× careful's after 40 days and 1.12× after 80; careful is ahead early and reaches the Reitschule on day 11–12 (sport: day 25–27), sport catches up in a long game |

## Current numbers

Sick days are counted in the morning, before the vet comes.

| Spielweise | Seed | Geld Tag 10 | Geld Tag 20 | Geld am Ende | Hof-Wert am Ende | Reitabzeichen (Tag) | Hof-Prüfung (Tag) | Reitstunden | Turniere | Kranktage | höchste Schulden | festgefahren |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| careful | 1 | 632 € | 230 € | 391 € | 1831 € | 3 | 12 | 112 | 13 | 0 | 0 € | nein |
| careful | 2 | 711 € | 212 € | 323 € | 1653 € | 3 | 12 | 111 | 12 | 0 | 0 € | nein |
| careful | 3 | 696 € | 284 € | 535 € | 1655 € | 3 | 11 | 113 | 12 | 0 | 0 € | nein |
| careful | 4 | 648 € | 228 € | 458 € | 1758 € | 3 | 11 | 114 | 12 | 0 | 0 € | nein |
| careful | 5 | 676 € | 266 € | 368 € | 1728 € | 4 | 12 | 112 | 11 | 0 | 0 € | nein |
| careless | 1 | 517 € | 377 € | 215 € | 215 € | 3 | – | 31 | 10 | 14 | 0 € | nein |
| careless | 2 | 549 € | 513 € | 476 € | 476 € | 3 | 18 | 44 | 10 | 14 | 0 € | nein |
| careless | 3 | 581 € | 525 € | 329 € | 329 € | 3 | 18 | 37 | 10 | 14 | 0 € | nein |
| careless | 4 | 524 € | 402 € | 202 € | 202 € | 5 | – | 35 | 9 | 14 | 0 € | nein |
| careless | 5 | 514 € | 498 € | 563 € | 563 € | 4 | 21 | 49 | 9 | 14 | 0 € | nein |
| sport | 1 | 435 € | 476 € | 442 € | 1252 € | 3 | 25 | 64 | 13 | 0 | 0 € | nein |
| sport | 2 | 502 € | 534 € | 253 € | 1523 € | 3 | 25 | 66 | 13 | 0 | 0 € | nein |
| sport | 3 | 429 € | 468 € | 367 € | 1297 € | 3 | 25 | 66 | 13 | 0 | 0 € | nein |
| sport | 4 | 426 € | 618 € | 469 € | 1719 € | 5 | 25 | 69 | 12 | 0 | 0 € | nein |
| sport | 5 | 421 € | 650 € | 275 € | 1435 € | 4 | 25 | 66 | 12 | 0 | 0 € | nein |

## What changed because of it

- The first run had the inspection on day 4–6: the Kleiner Hof's goals were too small. Now 25 lessons (was 5),
  500 € saved (was 400) and reputation 60 (was 50). Horse energy (−30 a lesson, +40 a night, about 2.3 lessons a day
  with two ponies) is what paces the lessons, so the lesson goal sets the inspection day: about 2–4 play sessions.

- Careful used to beat sport on every seed: practice earned nothing by itself. Now shows have classes (E, A, L):
  a horse may start in A from jumping skill 40 and in L from 70, with bigger fees, stronger rivals and much bigger
  prizes (first place 60 €, 160 €, 220 €). Practice also brings more skill (+4 for a clear round, +2 with faults;
  was +3 and +1), so daily practice reaches class A in about two weeks. Lower thresholds made sport *worse*: a horse
  starting early meets rivals it can't beat. A first prize of 300 € in L made sport win every seed after 60 days,
  so the test checks a 40-day and an 80-day game. With the arena's courses (#43: 6, 7 and 8 jumps instead of 5)
  more poles fall, so A pays a little more (160 €, was 150 €). Since the Reitschule starts with a free stall (#50)
  a horse from the market comes earlier, which helps sport most: L stays at 220 €.

- Since #58 a breed limits jumping (Haflinger and Isländer up to class A): the sport player buys the best jumper
  the market offers at the Reitschule, the careful one the cheapest horse.

## Open points

- The run's jumping rounds count knocked poles only: refusals and time faults on the arena (#43) are not in the
  model, so a real child's rounds come out a little worse. The riding badge allows 2 faults (was 1) for that reason.
- **Careless gets nowhere slowly.** About 14 sick days in 40 (a pony falls sick every few days and rests after the
  vet), so fewer lessons and a lower reputation: the inspection comes on day 18–21 or not within 40 days (2 of 5 seeds).
  Never stuck, but a child who neglects the ponies may wait long; Oma Hanne's hints are meant to catch that.
- The riding badge comes on day 3–5 for every strategy; it could ask for more practice.
