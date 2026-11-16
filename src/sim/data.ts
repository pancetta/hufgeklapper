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
  /** After this many times by hand, a care action can be done with one tap ("Schnell erledigen"). */
  quickCareAfter: 5,
  /** Each horse eats this many hay bales from the store every night. */
  hayPerNight: 1,
  /** The morning warns when the store holds hay for fewer nights than this. */
  hayLowNights: 2,
  /** Hay for sale on the notice board: bales and price per pack. */
  hayPacks: [{ bales: 5, price: 25 }, { bales: 10, price: 45 }],
  /** The bank lends this much at a time, while the debt stays below the limit. */
  loan: { amount: 100, debtLimit: 200 },
  /** Of every income, this share goes to paying back debt first. */
  repayShare: 0.5,
  /** The vet ("Tierarzt"): what a visit costs, the health it gives back, and the days the horse must rest. */
  vet: { cost: 40, health: 70, restDays: 2 },
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
  },
  /** The jumping minigame ("Springen"): course, take-off window (seconds) and what training does. */
  jumping: {
    window: { base: 0.12, skill: 0.2, kept: 0.1 },
    /** A tap more than this many seconds early is not yet a take-off. */
    early: 0.6,
    /**
     * The round on the show-jumping arena ("Springplatz", #43, #47), in arena pixels and seconds: the horse canters at
     * `speed` along the path the child drew, turning at most `turn` radians a second; a point of it within `reach`
     * counts as reached. Its hooves leave the ground `takeoff`
     * before the pole; a pole is `half` × 2 wide. Reaching a pole without a take-off, or riding at it more than
     * `refuse` degrees askew, the horse refuses: it stands `stop` seconds, then turns round. The time allowed is
     * the course's straight length ridden at `speed`, times `time`; each started `timeFault` seconds over it is a
     * fault, and `giveUp` seconds over it the round ends, each jump left a fault.
     */
    ride: { speed: 90, turn: 4, reach: 10, takeoff: 26, half: 26, refuse: 35, stop: 0.9, time: 2, timeFault: 5, giveUp: 45 },
    arena: { w: 480, h: 300, fence: 14 },
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
        start: [40, 150, 'E'], finish: [430, 160, 'S'],
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
      L: { minSkill: 70, fee: 50, prizes: [240, 145, 80], rivalSkill: [60, 90] }, // more and sport outearns lessons in a long game
    },
  },
  /** The goals ("Aufgaben") of each farm stage: what to reach; once reached, a goal stays done. */
  goals: {
    kleinerHof: [{ id: 'groom', need: 5 }, { id: 'lessons', need: 25 }, { id: 'badge', need: 1 }, { id: 'savings', need: 500 }, { id: 'reputation', need: 60 }],
    reitschule: [{ id: 'horses', need: 3 }, { id: 'lessons', need: 30 }, { id: 'reputation', need: 70 }, { id: 'savings', need: 600 }],
  } as Record<'kleinerHof' | 'reitschule', { id: 'groom' | 'lessons' | 'badge' | 'savings' | 'reputation' | 'horses'; need: number }[]>,
  /** Oma Hanne's hints: a need below this is worth a word; hay for fewer than this many nights too. */
  hints: { needBelow: 30, hayNights: 2 },
  /** What Oma Hanne explains the first time the player opens it. */
  features: ['stable', 'care', 'board', 'arena'] as const,
  /** The player's figure until they make their own (and for saves from before the avatar editor). */
  avatar: { name: 'Kim', skin: 0, hair: 'zopf', hairColor: 0, jacket: 1 } as const,
  /** A horse's own name: at most this many characters, so it fits on the nameplate. */
  horseName: { max: 16 },
  pupilNames: ['Lea', 'Ben', 'Mia', 'Paul', 'Emma', 'Finn', 'Lina', 'Noah', 'Sophie', 'Elias', 'Mila', 'Jonas', 'Ida', 'Theo', 'Nele', 'Anton'],
  /** Stalls ("Boxen") in the stable, per farm stage. */
  stalls: { kleinerHof: 2, reitschule: 2 },
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
  /** The farm stage that unlocks building on a free plot. */
  freePlotsFrom: 'reitschule',
} as const;
