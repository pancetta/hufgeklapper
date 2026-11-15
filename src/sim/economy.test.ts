import { describe, expect, it } from 'vitest';
import { play, type Strategy, summary, TABLE_HEAD } from './economy';

// The balance targets of #18, on fixed seeds. `ECONOMY=1 npx vitest run src/sim/economy.test.ts` prints the table for docs/economy.md.
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

  it('has no single best way to play: after 40 days no strategy has more than twice the money of another that cares', () => {
    const careful = median(of('careful').map((r) => r.money.at(-1)!)), sport = median(of('sport').map((r) => r.money.at(-1)!));
    expect(Math.max(careful, sport) / Math.max(1, Math.min(careful, sport))).toBeLessThan(2);
  });
});
