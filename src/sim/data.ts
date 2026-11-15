/**
 * Every number the game rules use, in one place, so balancing is editing this table.
 * Needs run from 0 to 100, and full is good: a full bar means fed, clean, happy, rested, healthy.
 */
export const DATA = {
  start: { money: 300, feed: 10 },
  needs: {
    /** How much each need falls overnight, before care fills it again; a negative loss is a gain (sleep restores energy). */
    nightlyLoss: { fed: 35, clean: 20, happy: 15, energy: -40, health: 0 },
    /** Where new horses start. */
    start: { fed: 80, clean: 70, happy: 80, energy: 90, health: 100 },
  },
} as const;
