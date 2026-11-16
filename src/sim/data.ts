/**
 * Every number the game rules use, in one place, so balancing is editing this table.
 * Needs run from 0 to 100, and full is good: a full bar means fed, clean, happy, rested, healthy.
 */
export const DATA = {
  start: { money: 300, feed: 10 },
  needs: {
    /** How much each need falls overnight, before care fills it again; a negative loss is a gain (sleep restores energy). */
    nightlyLoss: { fed: 35, clean: 20, happy: 15, energy: -40, health: 0 },
    /** With no hay left for the night, a horse loses this much more. */
    hungryNight: { fed: 25, happy: 10 },
    /** A need below this overnight harms health; a horse with none below it heals a little. */
    neglectBelow: 30,
    healthLossPerNeglect: 12,
    healthGain: 5,
    /** Where new horses start. */
    start: { fed: 80, clean: 70, happy: 80, energy: 90, health: 100 },
    /** Below this health a horse is sick. */
    sickBelow: 30,
  },
  /** What each care action ("Pflege") fills; feeding takes one bale from the store. */
  care: {
    groom: { clean: 45, happy: 5 },
    hooves: { health: 5, happy: 5 },
    feed: { fed: 45, happy: 5 },
    muck: { clean: 20, happy: 10 },
  },
  /**
   * The care course ("Pflegekurs", #72): every step of getting a horse ready, a walk ride and putting it away. It counts
   * as grooming and hooves for the day; the horse gets happier, the walk ride (alone) costs a little energy, and a lesson
   * prepared this way pays a tip and some reputation. Without a wrong step there is more. `straps`: the bridle's buckles.
   */
  routine: {
    energy: 10, pace: 0.5, happy: 8, happyClean: 15, tip: 3, tipClean: 6, reputation: 1, reputationClean: 2,
    straps: { islaender: 2, haflinger: 2, reitpony: 2, quarter: 2, warmblut: 3 },
  },
  /** After this many times by hand, a care action can be done with one tap ("Schnell erledigen"). */
  quickCareAfter: 5,
  /** Each horse eats this many hay bales from the store every night. */
  hayPerNight: 1,
  /** The morning warns when the store holds hay for fewer nights than this. */
  hayLowNights: 2,
  /** Hay for sale in the feed store: bales and price per pack. */
  hayPacks: [{ bales: 5, price: 25 }, { bales: 10, price: 45 }],
  /** The bank lends this much at a time, while the debt stays below the limit. */
  loan: { amount: 100, debtLimit: 200 },
  /** Of every income, this share goes to paying back debt first. */
  repayShare: 0.5,
  /** The vet ("Tierarzt"): what a visit costs, the health it gives back, and the days the horse must rest. */
  vet: { cost: 40, health: 70, restDays: 2 },
  /**
   * Oma Hanne's help when nothing else works (#66, #68): every horse of your own sick, no money for the vet and no
   * more loans. The first time, she pays the vet for them in the night and brings `hay` bales. She helps only once:
   * in a second dead end she warns each morning, and after `grace` mornings in a row the farm is lost (game over),
   * unless good care makes a horse healthy again first.
   */
  rescue: { hay: 6, grace: 7 },
  /** Riding lessons ("Reitstunden"). */
  lessons: {
    /** What a lesson pays at best, by the pupil's level. */
    pay: { beginner: 20, advanced: 30 },
    /** The energy a lesson costs the horse; a horse with less is too tired. */
    energy: 30,
    /** How well pupil and horse fit: a small child belongs on a pony, a big one on a horse. */
    fit: { right: 1, smallOnHorse: 0.7, bigOnPony: 0.6 },
    /** Reputation (0–100) gains from a happy pupil and loses from an unhappy one, around this satisfaction. */
    happyAt: 60,
    /** From this satisfaction on, a pupil is delighted ("begeistert"). */
    delightedAt: 80,
    /** Pupils waiting each morning: one, plus one more at each of these reputations. */
    morePupilsAt: [40, 70],
    startReputation: 30,
    /** Below this share of full needs (fed, clean, happy), a horse is said to need care before a lesson. */
    keptWell: 0.6,
  },
  /** The jumping minigame ("Springen"): course, take-off window (seconds) and what training does. */
  jumping: {
    window: { base: 0.12, skill: 0.2, kept: 0.1 },
    /** How far a breed can come in jumping (#58): practice raises a horse's skill up to this, so higher classes need the right horse. */
    scope: { islaender: 50, haflinger: 60, quarter: 75, reitpony: 80, warmblut: 100 },
    /** Momentum for higher jumps (#58): seconds the finger is held before letting go at take-off, by class; a skilled horse needs up to `holdSkill` less. */
    hold: { E: 0, A: 0.35, L: 0.55 },
    holdSkill: 0.4,
    /** A tap more than this many seconds early is not yet a take-off. */
    early: 0.6,
    /**
     * The round on the show-jumping arena ("Springplatz", #43, #47), in arena pixels and seconds: the horse canters at
     * `speed` along the path the child drew, turning at most `turn` radians a second; a point of it within `reach`
     * counts as reached. It speeds up by `speedUp` along a way and brakes by `brake` at its end, so it stands about
     * where the way ends (#54); riding piece by piece takes stops, so the time allowed is generous. Its hooves leave the ground `takeoff`
     * before the pole; a pole is `half` × 2 wide. Reaching a pole without a take-off, or riding at it more than
     * `refuse` degrees askew, the horse refuses: it stands `stop` seconds, then turns round. The time allowed is
     * the course's straight length ridden at `speed`, times `time`; each started `timeFault` seconds over it is a
     * fault, and `giveUp` seconds over it the round ends, each jump left a fault.
     */
    ride: { speed: 90, speedUp: 150, brake: 400, turn: 4, reach: 10, takeoff: 26, half: 26, refuse: 35, stop: 0.9, time: 3, timeFault: 5, giveUp: 45 },
    arena: { w: 480, h: 300, fence: 14 },
    /** How high a class's poles rest (arena pixels): low for E, higher for A and L; the oxer spreads with it. */
    height: { E: 5, A: 7, L: 9 },
    /**
     * Building a course (#56): a jump stands `runIn` from the fence along its way and `apart` from every other; the
     * next one lies `straight` ahead, or `ahead` then `turn` along after a quarter turn;
     * so many of a class's jumps are oxers; the search places at most `budget` jumps a try; a course is used if the
     * autopilot rides it in `share` of the time allowed; after `tries` the fixed course below is ridden.
     */
    build: { runIn: 60, apart: 66, straight: [100, 150], ahead: [40, 90], turn: [70, 120], oxers: { E: 0, A: 2, L: 4 }, budget: 3000, share: 0.5, tries: 100 },
    /** The courses ("Parcours"), by show class; practice and the riding badge use E. Arena pixels; a jump is ridden the way of `dir`. */
    courses: {
      E: {
        start: [40, 250, 'E'], finish: [230, 200, 'E'],
        jumps: [
          { x: 140, y: 250, dir: 'E', kind: 'cross' }, { x: 280, y: 250, dir: 'E', kind: 'upright' }, { x: 420, y: 160, dir: 'N', kind: 'cross' },
          { x: 300, y: 50, dir: 'W', kind: 'upright' }, { x: 160, y: 50, dir: 'W', kind: 'cross' }, { x: 50, y: 150, dir: 'S', kind: 'upright' },
        ],
      },
      A: {
        start: [40, 215, 'E'], finish: [430, 160, 'S'],
        jumps: [
          { x: 130, y: 150, dir: 'E', kind: 'upright' }, { x: 260, y: 150, dir: 'E', kind: 'oxer' }, { x: 250, y: 245, dir: 'W', kind: 'cross' },
          { x: 130, y: 245, dir: 'W', kind: 'oxer' }, { x: 45, y: 140, dir: 'N', kind: 'upright' }, { x: 180, y: 50, dir: 'E', kind: 'upright' },
          { x: 330, y: 50, dir: 'E', kind: 'oxer' },
        ],
      },
      L: {
        start: [40, 250, 'E'], finish: [445, 210, 'E'],
        jumps: [
          { x: 130, y: 250, dir: 'E', kind: 'upright' }, { x: 250, y: 250, dir: 'E', kind: 'oxer' }, { x: 400, y: 130, dir: 'N', kind: 'oxer' },
          { x: 300, y: 45, dir: 'W', kind: 'upright' }, { x: 180, y: 45, dir: 'W', kind: 'oxer' }, { x: 60, y: 165, dir: 'S', kind: 'upright' },
          { x: 200, y: 210, dir: 'E', kind: 'oxer' }, { x: 330, y: 210, dir: 'E', kind: 'upright' },
        ],
      },
    } as Record<'E' | 'A' | 'L', import('./round').Course>,
    gain: { clear: 4, faults: 2 }, // daily practice brings a horse to class A in about two weeks
    energy: 25,
    happy: 5,
  },
  /** Riding badge 1 ("Reitabzeichen"): open after some jumping practice; pass the quiz and a jumping round. */
  badge: { trainings: 3, questions: 5, answers: 3, quizPass: 4, maxFaults: 2 }, // a refusal and a pole, or a refusal and its lost time
  /**
   * Jumping shows ("Turniere"): one on every few days once riding badge 1 is passed. Scores: 100, minus points per
   * knocked pole, plus a little for the horse's jumping skill. Rivals ride horses of random skill; each of their
   * jumps falls with a chance that shrinks with skill.
   */
  shows: {
    every: 3,
    faultPoints: 20,
    skillPoints: 0.1,
    rivalFaultChance: 0.5,
    rivals: [['Lotta', 'Sternchen'], ['Jonas', 'Blitz'], ['Emil', 'Fanny'], ['Hanna', 'Moritz'], ['Ella', 'Pünktchen'], ['Ole', 'Wirbelwind']],
    rivalsPerShow: 4,
    /**
     * Classes ("Klassen"), easiest first: a horse may start once its jumping skill reaches `minSkill`. Higher classes
     * cost more and meet better rivals, but pay much more: training a horse is how sport earns money.
     */
    classes: {
      E: { minSkill: 0, fee: 15, prizes: [60, 35, 20], rivalSkill: [10, 50] }, // the first shows: a clear round usually reaches the podium
      A: { minSkill: 40, fee: 30, prizes: [160, 95, 55], rivalSkill: [35, 70] },
      L: { minSkill: 70, fee: 50, prizes: [220, 130, 75], rivalSkill: [60, 90] }, // more and sport outearns lessons in a long game
    },
  },
  /** The goals ("Aufgaben") of each farm stage: what to reach; once reached, a goal stays done. */
  goals: {
    kleinerHof: [{ id: 'groom', need: 5 }, { id: 'lessons', need: 25 }, { id: 'badge', need: 1 }, { id: 'savings', need: 500 }, { id: 'reputation', need: 60 }],
    reitschule: [{ id: 'horses', need: 3 }, { id: 'lessons', need: 30 }, { id: 'reputation', need: 70 }, { id: 'savings', need: 600 }],
    pensionsstall: [{ id: 'boarders', need: 2 }, { id: 'staff', need: 1 }, { id: 'partBoard', need: 1 }, { id: 'reputation', need: 75 }, { id: 'savings', need: 900 }],
  } as Record<'kleinerHof' | 'reitschule' | 'pensionsstall', { id: 'groom' | 'lessons' | 'badge' | 'savings' | 'reputation' | 'horses' | 'boarders' | 'staff' | 'partBoard'; need: number }[]>,
  /** Oma Hanne's hints: a need below this is worth a word; hay for fewer than this many nights too. */
  hints: { needBelow: 30, hayNights: 2 },
  /** What Oma Hanne explains the first time the player opens it. */
  features: ['stable', 'care', 'board', 'arena', 'fit', 'store'] as const,
  /** The player's figure until they make their own (and for saves from before the avatar editor). */
  avatar: { name: 'Kim', skin: 0, hair: 'zopf', hairColor: 0, jacket: 1 } as const,
  /** A horse's own name: at most this many characters, so it fits on the nameplate. */
  horseName: { max: 16 },
  pupilNames: ['Lea', 'Ben', 'Mia', 'Paul', 'Emma', 'Finn', 'Lina', 'Noah', 'Sophie', 'Elias', 'Mila', 'Jonas', 'Ida', 'Theo', 'Nele', 'Anton'],
  /** Stalls ("Boxen") in the stable, per farm stage. */
  stalls: { kleinerHof: 2, reitschule: 3, pensionsstall: 5 }, // each stage has room for one or two more at once
  /** The farm stages in order ("Hofstufen"): each farm inspection opens the next. */
  stages: ['kleinerHof', 'reitschule', 'pensionsstall'] as const,
  /**
   * The farm inspection ("Hof-Prüfung") after all goals of the Kleiner Hof: a quiz with the inspector. At the
   * Reitschule: a horse market with fresh offers each morning, stall places to build on the free plot, the arena
   * to upgrade for one more pupil a day.
   */
  inspection: { questions: 5, answers: 3, pass: 4 },
  market: {
    offers: 3,
    price: { pony: [220, 380], horse: [420, 620] },
    breeds: ['haflinger', 'islaender', 'reitpony', 'warmblut', 'quarter'],
    names: ['Blitz', 'Sternchen', 'Fanny', 'Moritz', 'Pünktchen', 'Lotte', 'Max', 'Wolke', 'Karamell', 'Nugget', 'Bella', 'Sammy', 'Flocke', 'Sunny'],
  },
  build: { stalls: { cost: 300, places: 2 }, arena: { cost: 250, pupils: 1 } },
  /**
   * The Pensionsstall (#62, #63). A groom ("Pferdepfleger") cares for `horses` horses each night for `wage` a day;
   * one of each of `names` at most. Boarders ("Einsteller") bring their horse into a free stall and pay each day; badly kept
   * (fed, clean and happy below `keptBelow`, or sick) for `patience` nights, they leave and the reputation drops by
   * `leaveReputation`. A part-boarder ("Reitbeteiligung") rides one of your horses each day for `pay` and its energy.
   */
  staff: { wage: 40, horses: 4, names: ['Tom', 'Lisa'] }, // help costs: you pay for the time it saves
  boarders: {
    offers: 2, pay: [6, 10], keptBelow: 0.5, patience: 3, leaveReputation: 10, // modest money for a stall and care: lessons stay the main income
    owners: ['Familie Weber', 'Familie Klein', 'Frau Sommer', 'Herr Yilmaz', 'Familie Novak', 'Frau Jansen', 'Herr Becker'],
  },
  partBoard: { pay: [8, 12], energy: 25 },
  /** The farm stage that unlocks building on a free plot. */
  freePlotsFrom: 'reitschule',
} as const;
