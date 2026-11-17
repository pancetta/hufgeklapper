import { describe, expect, it } from 'vitest';
import { play, type Strategy, summary, TABLE_HEAD } from './economy';
import { DATA } from './data';
import { apply, newGame } from './state';

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

  it('brings a careful player on to the Pensionsstall about ten days after the Reitschule', () => {
    const days = SEEDS.map((seed) => play('careful', seed, 60).pensionDay);
    for (const d of days) expect(d).not.toBeNull();
    expect(median(days as number[])).toBeLessThanOrEqual(30);
  });

  it('never loses a careful farm; a careless one gets a long chance (Oma helps once) before it is lost', () => {
    for (const seed of SEEDS) expect(play('careful', seed, 120).lostDay, `careful, seed ${seed}`).toBeNull();
    // careless reaches a second dead end in a long game; it must take about two months (66–111 on seeds 1–10)
    for (const seed of SEEDS) expect(play('careless', seed, 120).lostDay ?? Infinity, `careless, seed ${seed}`).toBeGreaterThanOrEqual(60);
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

  // progress (#78): a ride a day, clear about every other time, makes visible steps and reaches class A in about two
  // weeks, the same in both disciplines; the sport player grows both skills alike
  it('a ride a day brings a horse to class A in about 10–14 rides, in jumping and cross-country alike', () => {
    for (const [type, k] of [['train', 'jumping'], ['xcTrain', 'crossCountry']] as const) {
      let s = { ...newGame(2), badges: 1 }, rides = 0;
      const h = () => s.horses[0];
      while (h().skills[k] < DATA.shows.classes.A.minSkill && rides < 40) {
        s = { ...s, horses: s.horses.map((x) => ({ ...x, needs: { ...DATA.needs.start } })) }; // well cared for
        s = apply(s, { type, horse: h().id, faults: rides % 2 });
        s = apply(s, { type: 'sleep' }); rides++;
      }
      expect(rides, k).toBeGreaterThanOrEqual(10);
      expect(rides, k).toBeLessThanOrEqual(14);
    }
    const sport = play('sport', 3, 40);
    expect(Math.abs(sport.jumping - sport.crossCountry)).toBeLessThan(20);
  });

  // selling (#85): a player who buys horses, trains them and sells them must not get rich by trading alone
  it('buying, training and selling horses pays less than careful or sport play', () => {
    const seeds = [...Array(10)].map((_, i) => i + 1);
    for (const days of [40, 80]) {
      const worth = (st: Strategy) => median(seeds.map((seed) => play(st, seed, days).worth));
      const dealer = seeds.map((seed) => play('dealer', seed, days));
      expect(dealer.some((r) => r.sold > 0), `${days} days: the dealer sells`).toBe(true);
      expect(worth('dealer'), `${days} days`).toBeLessThan(Math.min(worth('careful'), worth('sport')));
    }
  });

  it('the sport player takes riding badge 2 and rides cross-country shows (#74, #75)', () => {
    for (const r of of('sport')) {
      expect(r.badge2Day, `seed ${r.seed}`).not.toBeNull();
      expect(r.xcShows, `seed ${r.seed}`).toBeGreaterThan(0);
    }
  });
});
