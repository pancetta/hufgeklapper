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
  /** Each horse eats this many hay bales from the store every night. */
  hayPerNight: 1,
  /** The vet ("Tierarzt"): what a visit costs, the health it gives back, and the days the horse must rest. */
  vet: { cost: 40, health: 70, restDays: 2 },
  /** Stalls ("Boxen") in the stable, per farm stage. */
  stalls: { kleinerHof: 2, reitschule: 4 },
  /** The farm stage that unlocks building on a free plot. */
  freePlotsFrom: 'reitschule',
} as const;
