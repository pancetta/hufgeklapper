# Economy run

A headless run of the Sim checks the balance (`src/sim/economy.ts`, issue #18). It plays 40 days from a new game on
five fixed seeds with three simple strategies, using only actions a child has. Jumping rounds knock each pole one time
in five, like a child of middling skill.

- **careful**: buys hay ahead, cares for every horse every day, gives every lesson, practises for the badge, rides
  every show; at the Reitschule builds stall places, buys the cheapest horse and upgrades the arena when the money allows.
- **careless**: buys hay only when it is gone and cares only every third day; gives lessons, rides shows, never builds.
- **sport**: like careful, but jumping first: practises every day after the badge and gives only one lesson a day
  until a third horse is there.

`npm test` checks the targets of #18 on every push (it takes well under a second):

1. A careful player reaches the first farm inspection in about 10–15 days (median of the seeds).
2. A careless player never gets stuck (all horses sick, no money for the vet and no more loans).
3. No single strategy is clearly best: after 40 days careful and sport are within a factor of 2 in money.

`npm run economy` prints the table below.

## Current numbers

| Spielweise | Seed | Geld Tag 10 | Geld Tag 20 | Geld am Ende | Reitabzeichen (Tag) | Hof-Prüfung (Tag) | Reitstunden | Turniere | Kranktage | höchste Schulden | festgefahren |
|---|---|---|---|---|---|---|---|---|---|---|---|
| careful | 1 | 623 € | 490 € | 706 € | 3 | 11 | 117 | 12 | 0 | 0 € | nein |
| careful | 2 | 701 € | 344 € | 1181 € | 3 | 12 | 126 | 12 | 0 | 0 € | nein |
| careful | 3 | 638 € | 194 € | 831 € | 3 | 11 | 120 | 11 | 0 | 0 € | nein |
| careful | 4 | 587 € | 243 € | 921 € | 3 | 11 | 121 | 12 | 0 | 0 € | nein |
| careful | 5 | 610 € | 251 € | 898 € | 5 | 12 | 120 | 12 | 0 | 0 € | nein |
| careless | 1 | 545 € | 510 € | 311 € | 3 | – | 39 | 10 | 0 | 0 € | nein |
| careless | 2 | 611 € | 582 € | 476 € | 3 | – | 41 | 10 | 0 | 0 € | nein |
| careless | 3 | 524 € | 487 € | 365 € | 3 | 18 | 41 | 10 | 0 | 0 € | nein |
| careless | 4 | 421 € | 315 € | 46 € | 3 | – | 30 | 10 | 0 | 25 € | nein |
| careless | 5 | 508 € | 514 € | 475 € | 5 | 21 | 45 | 9 | 0 | 0 € | nein |
| sport | 1 | 525 € | 177 € | 485 € | 3 | 16 | 94 | 13 | 0 | 0 € | nein |
| sport | 2 | 611 € | 306 € | 542 € | 3 | 16 | 101 | 13 | 0 | 0 € | nein |
| sport | 3 | 506 € | 290 € | 630 € | 3 | 16 | 102 | 13 | 0 | 0 € | nein |
| sport | 4 | 478 € | 397 € | 407 € | 3 | 16 | 91 | 13 | 0 | 0 € | nein |
| sport | 5 | 508 € | 161 € | 547 € | 5 | 16 | 93 | 12 | 0 | 0 € | nein |

## What changed because of it

- The first run had the inspection on day 4–6: the Kleiner Hof's goals were too small. Now 25 lessons (was 5),
  500 € saved (was 400) and reputation 60 (was 50). Horse energy (−30 a lesson, +40 a night) is what paces lessons.

## Open points

- The careless player has no sick days: caring every third day keeps the needs above the neglect line. Care
  matters for lesson pay and reputation, but neglect hardly hurts yet. Worth a look before the next stage.
- The riding badge comes on day 3–5 for every strategy; it could ask for more practice.
