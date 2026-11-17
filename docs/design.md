# Hufgeklapper – design

A browser game about running a riding farm, for children aged 8–12. It makes three things tangible: **caring** for horses and ponies, **riding sport**, and the **farm economy**. Played on an iPad in landscape by touch; also runs in desktop browsers. All player-facing text is German, short and simple. No sound for now (it may come later), never voice output.

Terms in **bold** are defined in [`GLOSSARY.md`](../GLOSSARY.md). Decisions that are hard to reverse are in [`docs/adr/`](adr/).

## The game in one paragraph

Oma Hanne hands the player her small **Farm**. The player cares for the **Horses** on the stable screen with touch gestures, gives **Lessons** to **Pupils** for money, buys feed and pays the vet, and rides the horses in the **Jumping** **Minigame**, where good care makes the jump easier. Two **Career tracks** open the game step by step: the **Farm stage** grows through **Farm inspections**, and the player's own **Riding badges** open harder sport. Later stages hand the routine care to staff, so experienced players spend their time on sport and economy instead.

## Core decisions

| Topic | Decision |
|---|---|
| Start | The player starts as farm owner with a minimal farm (2 ponies). No pupil phase. |
| Moving around | No walking avatar. The farm, the stable and the arena are tappable pixel-art screens. Characters appear only in activities (riding, shows, inspections). |
| Avatar | Simple editor at the start: name, skin tone, hair style and colour, jacket colour. |
| Time | No time budget in the MVP. A **Day** ends when the player taps *Schlafen gehen*. A time budget (06–20 Uhr) may come once staff exist. |
| What limits a day | Each horse's **Needs** (Hunger, Sauberkeit, Laune, Energie, Gesundheit). Riding and lessons use **Energie**; care refills needs. |
| Neglect | Low needs make the horse **sick**: the vet costs money and the horse rests for a few days. Horses never die. |
| Care | Touch gestures: brush by swiping over the coat, tap each hoof, and so on. After the same **Care action** has been done 5 times, *Schnell erledigen* unlocks for it. Later, staff take care over. |
| Care course | *Ganz genau pflegen* (#72): every handling step one by one in the stable aisle, from opening the box to closing it, with leading at a walk on the arena and the lesson in between. Stable aisle and stall are drawn to scale: sizes in metres from the horse's own height. From the horse card in the stable, or before a lesson for the pupil (a tip). Part of riding badge 2 (#74). |
| Sport | A short skill **Minigame**; the horse's needs and skills widen or narrow the timing window. |
| Horse views | Side view, large, in the stable and for care; top-down (walking in 4 directions) on the farm map and the course. Both come from the same LPC sheets. |
| Jumping view | Top-down on the show-jumping arena: the whole course in view, the child draws the way with one finger and the cantering horse rides it (a standing horse sets off only once the finger lifts), a short tap anywhere takes off in front of each jump (#47); the horse grows and its shadow stays on the ground during the jump (#43). |
| Cross-country view | Side view through the fields (#73), the land scrolling past; pace buttons (Schritt, Trab, Galopp) at the bottom, a tap anywhere is "Hopp!" at the green strip; the horse's breath (*Puste*) top left. Practice from the way *Ins Gelände* after riding badge 1; trains the horse's own cross-country skill. |
| Progress | Skills per discipline against the breed's limit on the horse card, with a 14-day chart and the week's gain; *Können* in the stable compares all horses; practice rounds and the farm diary say what got better (#78). |
| Living farm | The farm map is animated: horses and ponies wander and stand on the pasture, the windmill turns. |
| Career | Two tracks: **Farm stage** (Kleiner Hof → Reitschule → Pensionsstall → Zuchthof → Reitsportzentrum), each ended by a **Farm inspection** (goals plus a short quiz), and **Riding badges** (quiz plus minigame) that open harder sports. |
| First income | **Lessons**: pupils show up, the player assigns a horse, the lesson runs by itself; pay and satisfaction depend on the horse's needs and on the fit (small child → pony). |
| Building | Fixed **Plots** on a drawn farm map: tap a plot, choose a building, upgrade it later. Each building places itself on its plot (ground, fence, parts); a free plot shows stakes and a sign. |
| Farm map | The same living farm, now the player's: their horses on the pasture, labels on the places (stable, feed store, pasture, arena, notice board, free plot). Tapping a place or its label opens it or says in one short line what comes there. |
| Stable | A close-up of the aisle from the side (twice the farm's pixel size): each horse looks out over its half door; under each door its needs as icons with bars. Tapping a horse opens its card (name, breed, coat, needs, jumping, healthy or sick). |
| Top bar | Money, day, *Schlafen gehen* (the screen says good night, then the new day) and the menu. |
| Start screen | The living farm behind the title: herd and sheep on the pasture, a pony cantering over the jumps, chickens, a sleeping cat, a dog, butterflies, birds, cloud shadows, ripples on the pond; warm colours. |
| Difficulty | One level. Empty money box is no game over: feed on credit (*anschreiben*) and a small bank loan, with a friendly hint. Oma Hanne pulls the player out of one dead end (all own horses sick, no money, no loan); a second one that lasts 7 mornings loses the farm. More levels only once the balance holds. |
| Free play | Comes once there is more than one career stage worth unlocking (after the MVP). |
| Saves | 3 named **Save slots**, autosave, export and import as a file. |
| iPad app | Home-screen web app: full screen, landscape, works offline. |

## MVP

The MVP covers two farm stages and one riding badge, so both career tracks and all three pillars are playable and the balance can be tested early.

1. **New game**: choose a slot, build the avatar, Oma Hanne's intro.
2. **Kleiner Hof** (farm stage 1): 2 ponies, stable screen with care gestures, needs falling over days, feed bought and used up, sickness and vet, lessons as the income, the safety net, a goal list (*Aufgaben*) shown at all times, Oma Hanne's hints.
3. **Jumping** as training: improves the horse's skill, uses energy.
4. **Riding badge 1**: quiz plus a jumping round; passing opens **Shows** with prize money and AI rivals, in classes E, A and L that a trained horse unlocks.
5. **Farm inspection 1**: goals met plus a short quiz → **Reitschule** (farm stage 2): buy a horse (pony or big horse), build or upgrade stable places and the arena on the plots.
6. Horse looks: 2 **Builds** (pony, big horse), about 6 coats, 3 markings, mane colour, tack.
7. Credits screen, home-screen app, offline.

After the MVP: a farm diary at the end of each day (#60), and farm stage 3, the **Pensionsstall** (#61–#63): a second
farm inspection, **Boarders**, **Part-boarders** and a **Groom** who takes over the daily care.

Still later (rough order): more farm stages (Zuchthof with breeding), dressage, cross-country, races, carriage races, own shows, trading with other farms (horses, feed, manure), vehicles, time budget, free play, difficulty levels, sound.

## Economy

Money is in euros, whole numbers only. Every price, rate and need curve lives in one data table, so balancing is editing numbers. A headless **economy run** (a script that plays many days with simple strategies on fixed seeds, like truck-sim's) checks the curves: a careful player must be able to afford the first inspection in roughly 10–15 days, and a careless one must get a long chance before the farm is lost.

## Architecture

- **Vite + TypeScript, no game engine** ([ADR-0001](adr/0001-no-engine.md)).
- **Sim**: the game rules as a pure TypeScript module: state in, action in, new state out. It knows nothing about pixels or the DOM, and randomness comes from a seeded generator. All of it is tested with Vitest.
- **Screens** (farm map, stable, shop, menus) are HTML/CSS over pixel-art images, scaled by whole numbers with `image-rendering: pixelated`.
- **Minigames** each draw on one canvas with a small fixed-step loop. The rules of a minigame (timing window, scoring) live in the Sim and are tested there.
- **Horse looks** are composed from layers and palettes at load time and cached ([ADR-0002](adr/0002-layered-horses.md)).
- **Scenes** (`src/scene/`): the landscape map is painted once with LPC blob autotiling; buildings come from plots (`buildings.ts`); everything standing on the ground is drawn in order of its foot point, so nearer things overlap farther ones.
- **Strings**: every German text in one file; code identifiers are English, and the glossary maps the two.
- **Save**: JSON in `localStorage` per slot, with a version number; an import is validated before it replaces anything.

## Testing and CI

- Vitest for the Sim, the minigame rules, the horse compositor and the save format.
- Playwright on WebKit with an iPad landscape viewport and touch for the main flows (new game, care gestures, assigning a lesson, a jumping round, saving and loading).
- GitHub Actions on every push: test, build, deploy to GitHub Pages. A failing test stops the deploy.

## Art

Top-down pixel art in a 16-bit RPG style, 32px grid, from the LPC collection plus our own drawings in the same style; ponies are derived from the LPC horse by a script ([ADR-0003](adr/0003-lpc-art.md)). There is no budget for an artist. Every third-party file is listed in `CREDITS.md` and on the in-game credits screen.

## Ideas for later

- Manure as trade goods (fertiliser for the neighbour farmer).
- A horse passport or album to collect.
- Seasons that change the pasture.
