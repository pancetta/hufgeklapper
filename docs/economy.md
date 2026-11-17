# Economy run

A headless run of the Sim checks the balance (`src/sim/economy.ts`, issue #18). It plays 40 days from a new game on
five fixed seeds with three simple strategies, using only actions a child has. In jumping rounds a pole falls one time
in five on a new pony, less often the wider the horse's take-off window (skill and care, as in the minigame).

- **careful**: buys hay ahead, cares for every horse every day, gives every lesson, practises for the badge, rides
  every show (like every strategy, in the highest class its best horse may start in); at the Reitschule builds stall places, buys the cheapest horse and upgrades the arena when the money allows.
- **careless**: buys hay only when it is gone and cares only every third day; gives lessons, rides shows, never builds.
- **sport**: like careful, but jumping first: practises every day with its best jumper after the badge, so that horse
  grows into classes A and L, and gives only one lesson a day until a third horse is there.
  After the badge it also rides cross-country (#73) with whatever horse has energy left; a new pony refuses at one
  obstacle in six, fewer the wider its take-off window. Its refusals use their own random numbers, so they don't change the jumping rounds.

When a stall is free but the pasture is full (#79), the careful and sport players enlarge the pasture first, if the money
allows (its price plus 150 € to spare); before buying a horse only if the horse is still affordable afterwards.

The farm's worth ("Hof-Wert") is money minus debt plus what was spent on horses and building: a player who built
the arena is not poorer for it.

`npm test` checks the targets of #18 on every push (well under a second); `npm run economy` prints the table below.

| Target (#18) | Status |
|---|---|
| A careful player reaches the first farm inspection in about 10–15 days (median of the seeds) | met: day 11–12 |
| A careless player gets a long chance: Oma Hanne helps out of the first dead end (all horses sick, no money for the vet, no more loans) once (#66); a second dead end that lasts 7 mornings loses the farm (#68) | met: careful never loses (120 days); careless is lost on 8 of 10 seeds between day 66 and 93 of 120, never before day 60 |
| No single strategy is clearly best | met: on ten seeds, sport's median farm worth is 0.86× careful's after 40 days and 1.09× after 80 (with cross-country riding, #78, and the pasture limit, #79); careful is ahead early and reaches the Reitschule on day 11–12 (sport: day 25–27), sport catches up in a long game |
| A careful player reaches the Pensionsstall about ten days after the Reitschule | met: day 21–22 (60-day run, median ≤ 30) |
| Progress (#78): with a clear round every other time, a ride a day reaches class A in 10 rides, in jumping and cross-country alike; riding cross-country keeps the balance | met: 10 rides each (the gains in DATA); sport's best jumper and best cross-country horse are 60 / 70 (median, day 40); sport/careful worth with cross-country riding 0.86 at 40 days and 1.18 at 80, without it 0.89 / 1.09 (cross-country rolls its own dice); with the pasture limit (#79) 0.86 / 1.09 |
| Pasture (#79): a horse needs room on the pasture too (a pony 1 place, a big horse 2); strategies enlarge it when it is in the way, and the balance holds | met: careful reaches the Pensionsstall on day 21–22 as before; sport/careful worth 0.86 at 40 days, 1.09 at 80 (1.18 before: big horses now cost pasture too) |

## Current numbers

Sick days are counted in the morning, before the vet comes.

| Spielweise | Seed | Geld Tag 10 | Geld Tag 20 | Geld am Ende | Hof-Wert am Ende | Reitabzeichen (Tag) | Hof-Prüfung (Tag) | Reitstunden | Turniere | Kranktage | höchste Schulden | Hof verloren (Tag) | Können Springen / Gelände (Geländeritte) |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| careful | 1 | 632 € | 230 € | 272 € | 1571 € | 3 | 12 | 101 | 10 | 0 | 0 € | – | 14 / 10 (0) |
| careful | 2 | 711 € | 212 € | 317 € | 1794 € | 3 | 12 | 101 | 9 | 0 | 0 € | – | 18 / 10 (0) |
| careful | 3 | 696 € | 284 € | 380 € | 1671 € | 3 | 11 | 102 | 9 | 0 | 0 € | – | 16 / 10 (0) |
| careful | 4 | 648 € | 228 € | 363 € | 1600 € | 3 | 11 | 101 | 9 | 0 | 0 € | – | 14 / 10 (0) |
| careful | 5 | 676 € | 266 € | 496 € | 2008 € | 4 | 12 | 101 | 8 | 0 | 0 € | – | 16 / 10 (0) |
| careless | 1 | 517 € | 377 € | 215 € | 215 € | 3 | – | 31 | 10 | 14 | 0 € | – | 14 / 10 (0) |
| careless | 2 | 549 € | 513 € | 476 € | 476 € | 3 | 18 | 44 | 10 | 14 | 0 € | – | 16 / 10 (0) |
| careless | 3 | 581 € | 525 € | 329 € | 329 € | 3 | 18 | 37 | 10 | 14 | 0 € | – | 16 / 10 (0) |
| careless | 4 | 524 € | 402 € | 202 € | 202 € | 5 | – | 35 | 9 | 14 | 0 € | – | 14 / 10 (0) |
| careless | 5 | 514 € | 498 € | 563 € | 563 € | 4 | 21 | 49 | 9 | 14 | 0 € | – | 16 / 10 (0) |
| sport | 1 | 375 € | 416 € | 208 € | 1178 € | 3 | 27 | 51 | 13 | 0 | 0 € | – | 60 / 60 (30) |
| sport | 2 | 422 € | 454 € | 221 € | 1536 € | 3 | 26 | 63 | 13 | 0 | 0 € | – | 60 / 64 (31) |
| sport | 3 | 344 € | 383 € | 297 € | 1137 € | 3 | 25 | 63 | 13 | 0 | 0 € | – | 60 / 64 (29) |
| sport | 4 | 426 € | 618 € | 350 € | 1632 € | 5 | 25 | 67 | 12 | 0 | 16 € | – | 60 / 70 (30) |
| sport | 5 | 421 € | 643 € | 224 € | 1515 € | 4 | 26 | 65 | 12 | 0 | 0 € | – | 60 / 70 (32) |

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
  the market offers at the Reitschule and practises the horse that can still get better, best jumper first; it rides
  class L from about day 47–65. The careful player buys the cheapest horse. The run doesn't model the momentum of
  A and L, so real rounds there are a little harder.

- The Pensionsstall (#61–#63): boarders pay 6–10 € a day (modest money for a stall and care, so lessons stay the
  main income), a groom costs 40 € a day (you pay for the time saved). Higher boarder pay let the careful player,
  who reaches the Pensionsstall about two weeks before the sport player, run away (0.68× after 40 days).

## Open points

- **Careless over a long game:** hay on credit has no limit, so a careless player's debt passes the bank's limit;
  with every horse sick nothing earns. Oma Hanne pays the vet and brings hay in the first such dead end (#66). In a
  second one she only warns each morning; after 7 mornings without a healed horse the farm is lost (#68).
- The run's jumping rounds count knocked poles only: refusals and time faults on the arena (#43) are not in the
  model, so a real child's rounds come out a little worse. The riding badge allows 2 faults (was 1) for that reason.
- **Careless gets nowhere slowly.** About 14 sick days in 40 (a pony falls sick every few days and rests after the
  vet), so fewer lessons and a lower reputation: the inspection comes on day 18–21 or not within 40 days (2 of 5 seeds).
  A child who neglects the ponies may wait long; Oma Hanne's hints are meant to catch that before the farm is lost.
- The riding badge comes on day 3–5 for every strategy; it could ask for more practice.
