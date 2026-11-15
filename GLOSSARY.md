# Hufgeklapper

A browser game about running a riding farm, for children aged 8–12. UI words are German; this glossary gives the German word where the player sees one. Code uses the English term.

## Language

### Game and progress

**Sim**:
The game rules as a pure module: state in, action in, new state out. Everything the player sees is drawn from its state.
_Avoid_: engine, model, world

**Save** ("Spielstand"):
One stored game in one of 3 **Save slots**, written automatically; can be exported to and imported from a file.
_Avoid_: savegame, profile

**Day** ("Tag"):
One round of play. It ends when the player taps *Schlafen gehen*; then needs fall, feed is used up and sickness is checked.
_Avoid_: turn, tick

**Career track** ("Karriere"):
One of two independent ladders of progress: the **Farm stage** and the **Riding badges**.

**Farm stage** ("Hof-Stufe"):
How far the farm has grown: Kleiner Hof → Reitschule → Pensionsstall → Zuchthof → Reitsportzentrum. Each stage unlocks buildings, horses and features.
_Avoid_: level, tier

**Farm inspection** ("Hof-Prüfung"):
The step to the next **Farm stage**: all **Goals** of the stage met, then a short quiz with the inspector.

**Goal** ("Aufgabe"):
One item on the always-visible goal list, e.g. *Gib 5 Reitstunden*.
_Avoid_: quest, mission, achievement

**Riding badge** ("Reitabzeichen"):
The player's own riding level, earned by a quiz plus a **Minigame** round; opens harder sport such as **Shows**. Always say *Reitabzeichen*, never just *Abzeichen* (that word means **Markings**).

**Mentor** ("Oma Hanne"):
The former owner who hands over the farm, explains new things in short speech bubbles and gives hints.

**Avatar** ("Figur"):
The player's character, made in the avatar editor at the start; seen only in activities (riding, shows, inspections).

### Horses

**Horse** ("Pferd"):
Any horse or pony on the farm. Code says `horse` for both; the UI says *Pony* or *Pferd* by **Build**.

**Build** ("Körperbau"):
The body type with its own animation set: pony, big horse; later Shetland pony, draft horse, foal.

**Coat** ("Fellfarbe"):
The colour of a horse with the mane colour that belongs to it: Fuchs, Brauner, Rappe, Schimmel, Grauschimmel, Falbe, Isabell.

**Markings** ("Abzeichen"):
White patches drawn as overlays: on the face Stern, Blesse, Strich, Flocke; on the legs Socken, Stiefel.

**Breed** ("Rasse"):
Data only: a **Build** plus the **Coats** it allows (and its own mane colour, e.g. the Haflinger's blond).

**Tack** ("Zubehör"):
Saddle ("Sattel") and saddle pad ("Satteldecke"); the pad can take any colour.

**Needs** ("Bedürfnisse"):
Futter (fed), Sauberkeit (clean), Laune (happy), Energie (energy), Gesundheit (health), each 0–100, and a full bar is good. They fall over **Days** and through work; **Care actions** refill them. Say *Futter*, not *Hunger*, so a full bar never means "very hungry".

**Sick** ("krank"):
A horse whose needs stayed too low. It cannot be ridden until the **Vet** has treated it and it has rested.

### Care

**Care action** ("Pflege"):
Füttern, Putzen, Hufe auskratzen, Misten; done with touch gestures on the stable screen.

**Quick care** ("Schnell erledigen"):
One-tap version of a **Care action**, unlocked after doing it by hand 5 times.

**Vet** ("Tierarzt"):
Treats a **Sick** horse for money; afterwards it rests for a few days ("ruht sich aus") and can't be ridden or used for lessons.

**Morning** ("Guten Morgen!"):
After *Schlafen gehen*, a short list of last night's news: who fell sick, who is fit again, whether the hay ran out or runs low.

### Sport

**Minigame** ("Minispiel"):
A short skill game whose difficulty depends on the horse's **Needs** and skills.

**Jumping** ("Springen"):
The first **Minigame**: top-down, the course scrolls, tap at take-off.

**Training**:
Riding the **Jumping** minigame at home: raises the horse's skill, uses **Energie**.

**Show** ("Turnier"):
A competition against AI rivals with prize money ("Preisgeld"); opened by a **Riding badge**.

### Economy

**Money** ("Geld"):
Whole euros.

**Lesson** ("Reitstunde"):
A **Pupil** rides one of the farm's horses; it runs by itself once assigned and pays by the horse's state and fit.

**Pupil** ("Reitschüler"):
A visitor who books a **Lesson**. Small pupils fit a pony, big ones a horse. New pupils come each morning; a good **Reputation** brings more.

**Reputation** ("Ruf"):
How well the farm is known for its lessons (0–100). Happy pupils raise it, unhappy ones lower it.

**Feed** ("Futter", in hay bales: "Heuballen"):
Bought and stored; every horse eats one bale from the store each night. With none left it goes hungry.

**Plot** ("Bauplatz"):
A fixed place on the farm map where a building can be built and later upgraded. A free plot shows stakes, a string and a sign.

**Safety net**:
With no money, feed comes on credit ("anschreiben") and the bank gives a small loan ("Kredit"); there is no game over.
