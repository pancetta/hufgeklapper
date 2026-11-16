import { describe, expect, it } from 'vitest';
import { play, type Strategy, summary, TABLE_HEAD } from './economy';

// The balance targets of #18, on fixed seeds. `npm run economy` prints the table for docs/economy.md.
const SEEDS = [1, 2, 3, 4, 5], DAYS = 40;
const runs = (['careful', 'careless', 'sport'] as Strategy[]).flatMap((strategy) => SEEDS.map((seed) => play(strategy, seed, DAYS)));
const of = (strategy: Strategy) => runs.filter((r) => r.strategy === strategy);
const median = (xs: number[]) => [...xs].sort((a, b) => a - b)[xs.length >> 1];

describe('economy run', () => {
  if (process.env.ECONOMY) console.log([TABLE_HEAD, ...runs.map(summary)].join('\n'));

  it('brings a careful player to the first farm inspection in about 10–15 days', () => {
    for (const r of of('careful')) expect(r.inspectionDay, `seed ${r.seed}`).not.toBeNull();
    const day = median(of('careful').map((r) => r.inspectionDay!));
    expect(day).toBeGreaterThanOrEqual(10);
    expect(day).toBeLessThanOrEqual(15);
  });

  it('never gets a careless player stuck', () => {
    for (const r of of('careless')) expect(r.stuck, `seed ${r.seed}`).toBe(false);
  });

  // careful (lessons first) reaches the Reitschule sooner and is ahead early; sport (a trained horse in the higher show
  // classes) catches up later. Checked in a short and a long game, so a class prize can't make sport win the long run.
  it('has no single best way to play: careful and sport stay close in farm worth, in a short and a long game', () => {
    const seeds = [...Array(10)].map((_, i) => i + 1), ahead: Record<string, number> = { careful: 0, sport: 0 };
    for (const days of [40, 80]) {
      const careful = seeds.map((seed) => play('careful', seed, days).worth), sport = seeds.map((seed) => play('sport', seed, days).worth);
      careful.forEach((w, i) => { ahead[w > sport[i] ? 'careful' : 'sport']++; });
      const ratio = median(sport) / median(careful);
      expect(ratio, `${days} days`).toBeGreaterThan(0.8);
      expect(ratio, `${days} days`).toBeLessThan(1.25);
    }
    expect(ahead.careful, 'careful never ahead').toBeGreaterThan(0);
    expect(ahead.sport, 'sport never ahead').toBeGreaterThan(0);
  });
});
