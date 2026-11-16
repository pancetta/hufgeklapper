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
    jumps: 5,
    window: { base: 0.12, skill: 0.2, kept: 0.1 },
    /** A tap more than this many seconds early is not yet a take-off; this long after the window, the horse runs into the pole. */
    early: 0.6,
    late: 0.15,
    gain: { clear: 3, faults: 1 },
    energy: 25,
    happy: 5,
  },
  /** Riding badge 1 ("Reitabzeichen"): open after some jumping practice; pass the quiz and a jumping round. */
  badge: { trainings: 3, questions: 5, answers: 3, quizPass: 4, maxFaults: 1 },
  /**
   * Jumping shows ("Turniere"): one on every few days once riding badge 1 is passed. Scores: 100, minus points per
   * knocked pole, plus a little for the horse's jumping skill. Rivals ride horses of random skill; each of their
   * jumps falls with a chance that shrinks with skill.
   */
  shows: {
    every: 3,
    fee: 15,
    prizes: [60, 35, 20],
    faultPoints: 20,
    skillPoints: 0.1,
    rivalSkill: [10, 50], // the first shows: a clear round usually reaches the podium
    rivalFaultChance: 0.5,
    rivals: [['Lotta', 'Sternchen'], ['Jonas', 'Blitz'], ['Emil', 'Fanny'], ['Hanna', 'Moritz'], ['Ella', 'Pünktchen'], ['Ole', 'Wirbelwind']],
    rivalsPerShow: 4,
  },
  /** The goals ("Aufgaben") of each farm stage: what to reach; once reached, a goal stays done. */
  goals: {
    kleinerHof: [{ id: 'groom', need: 5 }, { id: 'lessons', need: 5 }, { id: 'badge', need: 1 }, { id: 'savings', need: 400 }, { id: 'reputation', need: 50 }],
    reitschule: [],
  } as Record<'kleinerHof' | 'reitschule', { id: 'groom' | 'lessons' | 'badge' | 'savings' | 'reputation'; need: number }[]>,
  /** Oma Hanne's hints: a need below this is worth a word; hay for fewer than this many nights too. */
  hints: { needBelow: 30, hayNights: 2 },
  /** What Oma Hanne explains the first time the player opens it. */
  features: ['stable', 'care', 'board', 'arena'] as const,
  /** The player's figure until they make their own (and for saves from before the avatar editor). */
  avatar: { name: 'Kim', skin: 0, hair: 'zopf', hairColor: 0, jacket: 1 } as const,
  pupilNames: ['Lea', 'Ben', 'Mia', 'Paul', 'Emma', 'Finn', 'Lina', 'Noah', 'Sophie', 'Elias', 'Mila', 'Jonas', 'Ida', 'Theo', 'Nele', 'Anton'],
  /** Stalls ("Boxen") in the stable, per farm stage. */
  stalls: { kleinerHof: 2, reitschule: 4 },
  /** The farm stage that unlocks building on a free plot. */
  freePlotsFrom: 'reitschule',
} as const;
