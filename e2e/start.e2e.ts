import { expect, type Page, test } from '@playwright/test';
import { DATA } from '../src/sim/data';
import { GESTURE, STEPS } from '../src/sim/routine';
import { lessonOutcome, type State } from '../src/sim/state';
import { t } from '../src/strings';

/**
 * Rides the course like a careful child who knows the way: whenever the horse waits, draws the whole way the
 * scene's autopilot would ride in one stroke and lifts the finger; while it rides, taps once for "Hopp!" when the
 * scene says so; until the round's result shows.
 */
async function rideCourse(page: Page) {
  const canvas = page.locator('#jumping'), end = page.locator('#jump-end'), until = Date.now() + 40_000;
  const box = (await canvas.boundingBox())!;
  let holding = false;
  while (await end.isHidden()) {
    if (Date.now() > until) throw new Error(`the round did not end in 40 s: the autopilot is lost (${await page.locator('#jump-hud').textContent()})`);
    const [way, hopp, press] = await canvas.evaluate((c) => [c.dataset.route ?? '', c.dataset.hopp ?? '', c.dataset.press ?? '']);
    // higher classes: hold the finger on the run-up strip for momentum, let go at take-off
    if (press && !holding) { await page.mouse.move(box.x + 20, box.y + 20); await page.mouse.down(); holding = true; continue; }
    if (hopp) { if (holding) { await page.mouse.up(); holding = false; } else await page.mouse.click(box.x + 20, box.y + 20); continue; } // a tap anywhere: "Hopp!"
    if (!way || holding) continue;
    const points = way.split(' ').map((p) => p.split(',').map(Number));
    await page.mouse.move(points[0][0], points[0][1]);
    await page.mouse.down();
    for (const [x, y] of points.slice(1)) await page.mouse.move(x, y);
    await page.mouse.up();
    await expect(canvas).not.toHaveAttribute('data-route', way); // the horse sets off
  }
}

/**
 * Plays the care course through without a wrong step: for each step its thing from the bar, a tap on its place (a
 * brush stroked to and fro, each hoof or buckle tapped), and the walk ride drawn in one stroke.
 */
async function playRoutine(page: Page) {
  const canvas = page.locator('#routine'), say = page.locator('#say');
  const spot = async (at: string) => (JSON.parse((await canvas.getAttribute('data-spots'))!)[at] as string).split(',').map(Number);
  for (const s of STEPS) {
    if (!s.thing) { // the ride: the whole way to the finish, then back in the aisle
      const ride = page.locator('#jumping');
      await expect(ride).toHaveAttribute('data-route', /\d/);
      const points = (await ride.getAttribute('data-route'))!.split(' ').map((p) => p.split(',').map(Number));
      await page.mouse.move(points[0][0], points[0][1]); await page.mouse.down();
      for (const [x, y] of points.slice(1)) await page.mouse.move(x, y);
      await page.mouse.up();
      await page.getByRole('button', { name: t.next }).tap({ timeout: 30_000 }); // the lesson, then back in the aisle
      await expect(page.locator('#ride')).toBeHidden();
      continue;
    }
    await page.getByRole('button', { name: t.things[s.thing], exact: true }).tap();
    const [x, y] = await spot(s.at), how = GESTURE[s.id];
    if (how === 'brush') {
      await page.mouse.move(x, y); await page.mouse.down();
      for (let i = 0; i < 400 && !(await say.textContent())!.startsWith('✓'); i++) await page.mouse.move(x + (i % 2 ? 10 : -10), y);
      await page.mouse.up();
    } else {
      await page.mouse.click(x, y);
      if (how) for (const m of (await canvas.getAttribute('data-marks'))!.split(' ')) { const [mx, my] = m.split(',').map(Number); await page.mouse.click(mx, my); }
    }
    await expect(say, s.id).toHaveText(`✓ ${t.steps[s.id]}`);
  }
}

/**
 * Starts a new game in the first slot under the given farm name, with the default figure, and listens to Oma Hanne.
 * Unless `explain` is set, the game then carries on as if Oma had explained every feature already.
 */
async function newGame(page: Page, name: string, explain = false) {
  await page.getByRole('region', { name: t.slot(1) }).getByRole('button', { name: t.newGame }).tap();
  await page.getByLabel(t.farmName).fill(name);
  await page.getByRole('button', { name: t.start }).tap();
  for (let i = 0; i < t.intro('', []).length; i++) await page.getByRole('button', { name: t.next }).tap();
  await expect(page.getByRole('button', { name: t.next })).toBeHidden();
  if (!explain) await changeSave(page, (s) => { s.explained = [...DATA.features]; });
}

/** Changes the game in slot 1 as saved, then reloads and carries on with it. */
async function changeSave(page: Page, change: (state: Record<string, unknown>) => void) {
  const save = await page.evaluate(() => JSON.parse(localStorage.getItem('hufgeklapper.slot.0')!));
  change(save.state);
  await page.evaluate((s) => localStorage.setItem('hufgeklapper.slot.0', JSON.stringify(s)), save);
  await page.reload();
  await page.getByRole('region', { name: t.slot(1) }).getByRole('button', { name: t.resume }).tap();
}

test('a new game in slot 2: the player makes a figure, Oma Hanne hands over the farm, the slot keeps it', async ({ page }) => {
  await page.goto('./');
  await page.getByRole('region', { name: t.slot(2) }).getByRole('button', { name: t.newGame }).tap();
  await expect(page.getByRole('heading', { name: t.whoAreYou })).toBeVisible();
  await page.getByLabel(t.yourName).fill('Mara');
  const preview = () => page.locator('.preview').evaluate((c: HTMLCanvasElement) => c.toDataURL());
  const before = await preview();
  await page.getByRole('button', { name: t.hairStyles.zoepfe }).tap();
  await page.getByRole('button', { name: t.colour(t.looks.jacket, 5) }).tap();
  expect(await preview()).not.toBe(before); // the preview follows every choice
  await expect(page.getByRole('button', { name: t.hairStyles.zoepfe })).toHaveAttribute('aria-pressed', 'true');
  await page.getByLabel(t.farmName).fill('Lindenhof');
  await page.getByRole('button', { name: t.start }).tap();
  // Oma Hanne greets the player by name, one sentence at a time
  const lines = t.intro('Mara', ['Kiwi', 'Luna']);
  for (const line of lines) {
    await expect(page.getByText(line)).toBeVisible();
    await page.getByRole('button', { name: t.next }).tap();
  }
  await expect(page.getByRole('img', { name: t.omaHanne })).toBeHidden();
  await expect(page.getByText('Lindenhof')).toBeVisible();
  // after a reload slot 2 holds the game, with the figure as made
  await page.reload();
  await expect(page.getByRole('region', { name: t.slot(2) }).getByRole('heading', { name: 'Lindenhof' })).toBeVisible();
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('hufgeklapper.slot.1')!).state.avatar);
  expect(saved).toMatchObject({ name: 'Mara', hair: 'zoepfe', jacket: 4 });
});

test('the farm comes alive behind the title', async ({ page }) => {
  await page.goto('./');
  await expect(page.getByRole('heading', { name: t.title })).toBeVisible();
  const farm = page.locator('#farm');
  await expect(farm).toBeVisible();
  // the scene is drawn once its art has loaded: the canvas is no longer blank
  await expect.poll(() => farm.evaluate((c: HTMLCanvasElement) => c.getContext('2d')!.getImageData(c.width >> 1, c.height >> 1, 1, 1).data[3])).toBe(255);
});

test('no two labels on the farm overlap, on the smallest and the largest iPad', async ({ page }) => {
  await page.goto('./');
  await newGame(page, 'Sonnenhof');
  for (const size of [{ width: 1024, height: 768 }, { width: 1366, height: 1024 }]) {
    await page.setViewportSize(size);
    await page.waitForTimeout(300); // placed again after the resize
    const boxes = await page.locator('.label').evaluateAll((els) => els.map((e) => [e.textContent, e.getBoundingClientRect().toJSON()] as const));
    for (const [i, [a, ra]] of boxes.entries())
      for (const [b, rb] of boxes.slice(i + 1))
        expect(ra.left < rb.right && rb.left < ra.right && ra.top < rb.bottom && rb.top < ra.bottom, `${a} × ${b} at ${size.width}×${size.height}`).toBe(false);
  }
});

test('a new game: farm map, stable, horse card, then sleeping through the night', async ({ page }) => {
  await page.goto('./');
  await newGame(page, 'Sonnenhof');
  // the farm map with the top bar
  await expect(page.getByText('Sonnenhof')).toBeVisible();
  await expect(page.getByText(t.money(300))).toBeVisible();
  await expect(page.getByText(t.day(1))).toBeVisible();
  // the feed store shows its bales and sells hay
  await page.getByRole('button', { name: t.places.feed }).tap();
  await expect(page.locator('#stock')).toHaveText(t.stock(10, 5));
  await page.getByRole('button', { name: t.hayPack(5, 25) }).tap();
  await expect(page.locator('.toast')).toHaveText(t.bought(5));
  await expect(page.locator('#hay')).toHaveText(t.hay(15));
  await expect(page.locator('#stock')).toHaveText(t.stock(15, 7));
  await expect(page.locator('#money')).toHaveText(t.money(275));
  await page.screenshot({ path: test.info().outputPath('store.png') });
  await page.getByRole('button', { name: t.toFarm }).tap();
  // the notice board: nothing pinned up yet on a new farm
  await page.getByRole('button', { name: t.places.board }).tap();
  await expect(page.getByText(t.boardEmpty)).toBeVisible();
  await page.getByRole('button', { name: t.close }).tap();
  // the stable: both ponies with their needs
  await page.getByRole('button', { name: t.places.stall }).tap();
  for (const name of ['Kiwi', 'Luna']) await expect(page.locator('.nameplate', { hasText: name })).toBeVisible();
  await expect(page.getByRole('meter', { name: t.needs.fed })).toHaveCount(2);
  // the horse card
  await page.locator('.nameplate', { hasText: 'Kiwi' }).tap();
  await expect(page.getByText('Haflinger · Fuchs')).toBeVisible();
  await expect(page.getByText(t.healthy('Kiwi'))).toBeVisible();
  await page.getByRole('button', { name: t.close }).tap();
  // sleeping: a new day, and the ponies got hungry overnight
  const fed = page.getByRole('meter', { name: t.needs.fed }).first();
  const before = Number(await fed.getAttribute('aria-valuenow'));
  await page.getByRole('button', { name: t.sleep }).tap();
  // the farm diary first: today's hay as a red bar, the day's total and the money
  const diary = page.locator('.diary');
  await expect(diary.getByRole('heading', { name: t.diaryTitle(1) })).toBeVisible();
  await expect(diary.locator('.diary-row', { hasText: t.billWhat.hay })).toContainText(t.euros(-25));
  await expect(diary.locator('.diary-bar.out')).toHaveCount(1);
  await expect(diary).toContainText(t.diaryTotal(-25, 275));
  await page.screenshot({ path: test.info().outputPath('diary.png') });
  await page.getByRole('button', { name: t.goodNight }).tap();
  await expect(page.locator('#day')).toHaveText(t.day(2), { timeout: 5000 });
  expect(Number(await page.getByRole('meter', { name: t.needs.fed }).first().getAttribute('aria-valuenow'))).toBeLessThan(before);
  // back to the farm
  await page.getByRole('button', { name: t.toFarm }).tap();
  await expect(page.getByRole('button', { name: t.places.stall })).toBeVisible();
});

test('the game saves itself, carries on after a reload, and moves as a file', async ({ page }) => {
  await page.goto('./');
  await newGame(page, 'Wiesenhof');
  await page.getByRole('button', { name: t.sleep }).tap();
  await expect(page.locator('#day')).toHaveText(t.day(2), { timeout: 5000 });
  // a reload: the slot shows the saved day, and the game carries on there
  await page.reload();
  const slot = page.getByRole('region', { name: t.slot(1) });
  await expect(slot.getByText('Wiesenhof')).toBeVisible();
  await expect(slot.getByText(t.slotInfo(2, 300))).toBeVisible();
  // saving to a file
  const download = page.waitForEvent('download');
  await slot.getByRole('button', { name: t.exportSave }).tap();
  const file = await (await download).path();
  // a new game on that slot asks first; saying no keeps the save
  await slot.getByRole('button', { name: t.newGame }).tap();
  await expect(page.getByText(t.overwrite('Wiesenhof'))).toBeVisible();
  await page.getByRole('button', { name: t.no }).tap();
  await expect(slot.getByText('Wiesenhof')).toBeVisible();
  // a slot filled in another tab after this screen showed it as free still asks before it is overwritten
  const free = page.getByRole('region', { name: t.slot(3) });
  await page.evaluate(() => localStorage.setItem('hufgeklapper.slot.2', localStorage.getItem('hufgeklapper.slot.0')!));
  await free.getByRole('button', { name: t.newGame }).tap();
  await expect(page.getByText(t.overwrite('Wiesenhof'))).toBeVisible();
  await page.getByRole('button', { name: t.no }).tap();
  // a file that is not a save is refused with a message
  const other = page.getByRole('region', { name: t.slot(2) });
  await page.locator('#import-file').setInputFiles({ name: 'foto.json', mimeType: 'application/json', buffer: Buffer.from('{"bild": 1}') });
  await expect(page.getByRole('status')).toHaveText(t.importInvalid);
  // the saved file loads into another slot
  await other.getByRole('button', { name: t.importSave }).tap();
  await page.locator('#import-file').setInputFiles(file);
  await expect(other.getByText('Wiesenhof')).toBeVisible();
  // and the game carries on from the save
  await slot.getByRole('button', { name: t.resumeGame }).tap();
  await expect(page.locator('#day')).toHaveText(t.day(2));
});

test('a horse gets a name of its own; a name another horse has is refused', async ({ page }) => {
  await page.goto('./');
  await newGame(page, 'Sonnenhof');
  await page.getByRole('button', { name: t.places.stall, exact: true }).tap();
  await page.locator('.nameplate', { hasText: 'Kiwi' }).tap();
  await page.getByRole('button', { name: t.rename }).tap();
  const field = page.getByRole('textbox', { name: t.newName });
  await field.fill('Luna');
  await page.getByRole('button', { name: t.done }).tap();
  await expect(page.getByText(t.nameTaken)).toBeVisible();
  await field.fill('Sternchen');
  await field.press('Enter');
  await expect(page.locator('.horse-card h2')).toHaveText('Sternchen');
  await expect(page.locator('.nameplate', { hasText: 'Sternchen' })).toBeVisible();
  // kept after a reload
  await page.reload();
  await page.getByRole('button', { name: t.resume }).first().tap();
  await page.getByRole('button', { name: t.places.stall, exact: true }).tap();
  await expect(page.locator('.nameplate', { hasText: 'Sternchen' })).toBeVisible();
});

test('a sick pony: red name plate, the vet heals it for money; no hay shows in the morning', async ({ page }) => {
  await page.goto('./');
  await newGame(page, 'Krankenhof');
  // change the saved game: Kiwi is sick and the hay store is empty
  await page.evaluate(() => {
    const save = JSON.parse(localStorage.getItem('hufgeklapper.slot.0')!);
    save.state.horses[0].needs.health = 10;
    save.state.feed = 0;
    localStorage.setItem('hufgeklapper.slot.0', JSON.stringify(save));
  });
  await page.reload();
  await page.getByRole('region', { name: t.slot(1) }).getByRole('button', { name: t.resumeGame }).tap();
  await page.getByRole('button', { name: t.places.stall }).tap();
  await expect(page.locator('.nameplate.sick', { hasText: 'Kiwi' })).toBeVisible();
  await page.locator('.nameplate', { hasText: 'Kiwi' }).tap();
  await expect(page.getByText(t.sick('Kiwi'))).toBeVisible();
  await page.getByRole('button', { name: t.callVet(40) }).tap();
  await expect(page.getByText(t.resting('Kiwi'))).toBeVisible();
  await expect(page.getByText(t.money(260))).toBeVisible();
  await page.getByRole('button', { name: t.close }).tap();
  // a night without hay: the morning says so (after the diary of the vet's bill)
  await page.getByRole('button', { name: t.sleep }).tap();
  await page.getByRole('button', { name: t.goodNight }).tap();
  await expect(page.getByText(t.newsNoHay)).toBeVisible({ timeout: 5000 });
  await page.getByRole('button', { name: t.morningGo }).tap();
  await expect(page.getByText(t.newsNoHay)).toBeHidden();
});

test('caring for a pony with gestures: brush, hooves, hay, manure; quick care after five times', async ({ page }) => {
  await page.goto('./');
  await newGame(page, 'Pflegehof');
  await page.getByRole('button', { name: t.places.stall }).tap();
  await page.locator('.nameplate', { hasText: 'Kiwi' }).tap();
  await page.getByRole('button', { name: t.care, exact: true }).tap();
  await expect(page.getByText(t.careTitle('Kiwi'))).toBeVisible();
  await page.waitForTimeout(600); // the scene loads
  // the scene's layout, as the care scene computes it (logical pixels, scale S)
  const g = await page.locator('#care-scene').evaluate((c: HTMLCanvasElement) => {
    const r = c.getBoundingClientRect();
    return { left: r.left, top: r.top, S: r.width / c.width, W: c.width, H: c.height };
  });
  const lay = JSON.parse((await page.locator('#care-scene').getAttribute('data-layout'))!) as { cx: number; foot: number; hay: number[]; trough: number[] };
  const { foot, cx } = lay;
  const at = (x: number, y: number) => [g.left + x * g.S, g.top + y * g.S] as const;
  const swipe = async (x0: number, x1: number, ys: number[]) => {
    for (const y of ys) { await page.mouse.move(...at(x0, y)); await page.mouse.down(); await page.mouse.move(...at(x1, y), { steps: 12 }); await page.mouse.up(); }
  };
  const fed = page.getByText(t.doneCare.feed('Kiwi'));
  // brush: wipe over the whole coat until it shines
  await swipe(cx - 46, cx + 46, Array.from({ length: 16 }, (_, i) => foot - 72 + i * 4));
  await expect(page.getByText(t.doneCare.groom('Kiwi'))).toBeVisible();
  // hoof pick: tap along the hooves
  await page.getByRole('button', { name: t.tools.hooves }).tap();
  for (let x = cx - 60; x <= cx + 60; x += 3) await page.mouse.click(...at(x, foot + 1));
  await expect(page.getByText(t.doneCare.hooves())).toBeVisible();
  // hay: drag a bundle from the bale in the corner into the trough
  await page.getByRole('button', { name: t.tools.feed }).tap();
  await page.mouse.move(...at(lay.hay[0], lay.hay[1])); await page.mouse.down();
  await page.mouse.move(...at(lay.trough[0], lay.trough[1]), { steps: 15 }); await page.mouse.up();
  await expect(fed).toBeVisible();
  // pitchfork: swipe the straw clean
  await page.getByRole('button', { name: t.tools.muck }).tap();
  await swipe(cx - 54, cx + 14, Array.from({ length: Math.ceil((g.H - foot) / 4) }, (_, i) => foot + 4 + i * 4));
  await expect(page.getByText(t.doneCare.muck())).toBeVisible();
  await expect(page.locator('[data-tool].done')).toHaveCount(4);
  // the stable shows the effect: Kiwi is cleaner than Luna now
  await page.getByRole('button', { name: t.toStable }).tap();
  const clean = page.getByRole('meter', { name: t.needs.clean });
  expect(Number(await clean.nth(0).getAttribute('aria-valuenow'))).toBeGreaterThan(Number(await clean.nth(1).getAttribute('aria-valuenow')));
  // five times by hand unlocks quick care (four more mucking rounds, quickly via the saved game)
  await page.evaluate(() => {
    const save = JSON.parse(localStorage.getItem('hufgeklapper.slot.0')!);
    save.state.careDone.muck = 5;
    localStorage.setItem('hufgeklapper.slot.0', JSON.stringify(save));
  });
  await page.reload();
  await page.getByRole('region', { name: t.slot(1) }).getByRole('button', { name: t.resumeGame }).tap();
  await page.getByRole('button', { name: t.places.stall }).tap();
  await page.locator('.nameplate', { hasText: 'Luna' }).tap();
  await page.getByRole('button', { name: t.care, exact: true }).tap();
  await page.locator('[data-quick="muck"]').tap();
  await expect(page.getByText(t.doneCare.muck())).toBeVisible();
});

test('with no money, hay comes on credit and the bank lends for the vet', async ({ page }) => {
  await page.goto('./');
  await newGame(page, 'Sparhof');
  await page.evaluate(() => {
    const save = JSON.parse(localStorage.getItem('hufgeklapper.slot.0')!);
    save.state.money = 0;
    localStorage.setItem('hufgeklapper.slot.0', JSON.stringify(save));
  });
  await page.reload();
  await page.getByRole('region', { name: t.slot(1) }).getByRole('button', { name: t.resumeGame }).tap();
  await page.getByRole('button', { name: t.places.feed }).tap();
  await expect(page.getByText(t.omaCredit)).toBeVisible();
  await page.getByRole('button', { name: t.hayPackCredit(10, 45) }).tap();
  await expect(page.locator('#hay')).toHaveText(t.hay(20));
  await page.getByRole('button', { name: t.toFarm }).tap();
  await page.getByRole('button', { name: t.places.board }).tap();
  await expect(page.getByText(t.owe(45))).toBeVisible();
  await page.getByRole('button', { name: t.loan(100) }).tap();
  await expect(page.locator('#money')).toHaveText(t.money(100));
});

test('Oma Hanne explains once which horse fits whom, when no pony fits the pupil', async ({ page }) => {
  await page.goto('./');
  await newGame(page, 'Sonnenhof');
  await changeSave(page, (s) => {
    s.explained = DATA.features.filter((f) => f !== 'fit');
    (s.pupils as { size: string }[])[0].size = 'big'; // a big child: both ponies are too small
  });
  await page.locator('.label.pupil').tap();
  await expect(page.getByText(t.explain.fit)).toBeVisible();
  await page.getByRole('button', { name: t.gotIt }).tap();
  await expect(page.locator('#lesson [data-horse]')).toHaveCount(2);
  await expect(page.locator('#lesson [data-horse="kiwi"]')).toContainText('Ein Pony ist zu klein');
});

test('in a dead end Oma Hanne helps: every pony sick, no money, no more loans', async ({ page }) => {
  await page.goto('./');
  await newGame(page, 'Sonnenhof');
  await changeSave(page, (s) => {
    Object.assign(s, { money: 0, debt: DATA.loan.debtLimit, feed: 0 });
    for (const h of s.horses as { needs: { health: number } }[]) h.needs.health = 10;
  });
  await page.getByRole('button', { name: t.sleep }).tap();
  await expect(page.getByText(t.newsOmaHelped)).toBeVisible({ timeout: 5000 });
  await page.getByRole('button', { name: t.morningGo }).tap();
  await expect(page.locator('#hay')).toHaveText(t.hay(DATA.rescue.hay));
});

test('a second dead end lasting too long: Oma warns, then the farm is lost; the start screen says so', async ({ page }) => {
  await page.goto('./');
  await newGame(page, 'Sonnenhof');
  // Oma has helped before, and this dead end has lasted all but one morning
  await changeSave(page, (s) => {
    Object.assign(s, { money: 0, debt: DATA.loan.debtLimit, rescueDay: 1, day: 20, deadEnd: DATA.rescue.grace - 2 });
    for (const h of s.horses as { needs: { health: number } }[]) h.needs.health = 10;
  });
  await page.getByRole('button', { name: t.sleep }).tap();
  await expect(page.getByText(t.newsLastWarning(1))).toBeVisible({ timeout: 5000 });
  await page.getByRole('button', { name: t.morningGo }).tap();
  // one more night without care: lost
  await changeSave(page, (s) => { for (const h of s.horses as { needs: { health: number } }[]) h.needs.health = 10; });
  await page.getByRole('button', { name: t.sleep }).tap();
  await expect(page.getByRole('heading', { name: t.gameOverTitle })).toBeVisible({ timeout: 5000 });
  await page.getByRole('button', { name: t.toStart }).tap();
  await expect(page.getByRole('region', { name: t.slot(1) })).toContainText(t.lostFarm);
  await expect(page.getByRole('region', { name: t.slot(1) }).getByRole('button', { name: t.resumeGame })).toHaveCount(0);
});

test('a riding lesson: a pupil waits by the arena, picks a pony, rides a round and pays', async ({ page }) => {
  await page.goto('./');
  await newGame(page, 'Sonnenhof');
  await changeSave(page, (s) => { (s.pupils as { size: string }[])[0].size = 'small'; }); // a small child: a pony fits
  // one pupil waits on the first day; tapping the name asks for a horse
  const pupil = page.locator('.label.pupil');
  await expect(pupil).toHaveCount(1);
  const name = (await pupil.textContent())!;
  await pupil.tap();
  await expect(page.getByRole('heading', { name: t.pupilWants(name) })).toBeVisible();
  // each pony says how it fits and how the lesson would go; one is the best choice
  await expect(page.locator('#lesson [data-horse]')).toHaveCount(2);
  await expect(page.locator('#lesson [data-horse="kiwi"]')).toContainText(`${name} wäre`);
  await expect(page.locator('#lesson .choice.best')).toHaveCount(1);
  await expect(page.locator('#lesson .choice.best')).toContainText(t.bestChoice);
  // the pupil may get the pony ready step by step: yes opens the care course, stopping it (asked twice) leaves the
  // pupil waiting
  await page.locator('#lesson [data-horse="kiwi"]').tap();
  await expect(page.getByText(t.routineAsk(name, 'Kiwi'))).toBeVisible();
  await page.getByRole('button', { name: t.routineYes }).tap();
  await expect(page.locator('#say')).toHaveText(t.routineIntroPupil(name, 'Kiwi'));
  await page.getByRole('button', { name: t.routineLeave }).tap();
  await page.getByRole('button', { name: t.routineLeaveSure }).tap();
  await expect(pupil).toHaveCount(1);
  await pupil.tap();
  await page.locator('#lesson [data-horse="kiwi"]').tap();
  await page.getByRole('button', { name: t.routineNo }).tap();
  await expect(page.getByRole('status')).toHaveText(t.lessonRuns(name, 'Kiwi'));
  await expect(page.locator('#money')).not.toHaveText(t.money(300));
  await expect(pupil).toHaveCount(0);
  // the round ends with how the pupil liked it
  await expect(page.getByRole('status')).toContainText(`${name} war`, { timeout: 20_000 });
  // nobody else today: the arena says so
  await page.getByRole('button', { name: t.places.arena }).tap();
  await page.getByRole('button', { name: t.giveLesson }).tap();
  await expect(page.getByRole('status')).toHaveText(t.noPupils);
});

test('a lesson prepared in the care course: the pupil gets the pony ready, it is led, the lesson pays its tip', async ({ page }) => {
  test.setTimeout(120_000);
  await page.goto('./');
  await newGame(page, 'Sonnenhof');
  await changeSave(page, (s) => { (s.pupils as { size: string }[])[0].size = 'small'; });
  const state = () => page.evaluate(() => JSON.parse(localStorage.getItem('hufgeklapper.slot.0')!).state as State);
  const before = await state(), pay = lessonOutcome(before.pupils[0], before.horses.find((h) => h.id === 'kiwi')!).pay, pupil = page.locator('.label.pupil');
  await pupil.tap();
  await page.locator('#lesson [data-horse="kiwi"]').tap();
  await page.getByRole('button', { name: t.routineYes }).tap();
  await playRoutine(page);
  await expect(page.locator('#routine-end')).toContainText(t.routineDone('Kiwi', true));
  expect((await state()).money).toBe(before.money + pay + DATA.routine.tipClean);
  await page.getByRole('button', { name: t.toFarm }).tap();
  await expect(pupil).toHaveCount(0);
});

test('cross-country practice: closed before the riding badge; then pace, breath and "Hopp!" through the fields, the pony trains', async ({ page }) => {
  test.setTimeout(150_000); // the ride runs in real time, about a minute
  await page.goto('./');
  await newGame(page, 'Sonnenhof');
  await page.getByRole('button', { name: t.places.xc }).tap();
  await expect(page.getByText(t.xcLater)).toBeVisible();
  await changeSave(page, (s) => { s.badges = 1; });
  const kiwi = () => page.evaluate(() => JSON.parse(localStorage.getItem('hufgeklapper.slot.0')!).state.horses[0]);
  const before = await kiwi();
  await page.getByRole('button', { name: t.places.xc }).tap();
  await page.getByRole('button', { name: 'Kiwi' }).tap();
  await expect(page.getByText(t.xcHow(true)[0])).toBeVisible();
  await page.getByRole('button', { name: t.go }).tap();
  // a careful child: the pace Oma would ride (a trot before water and the ditch, a walk to breathe), "Hopp!" at the strip
  const canvas = page.locator('#xc'), end = page.locator('#xc-end'), box = (await canvas.boundingBox())!;
  while (await end.isHidden()) {
    const [advice, hopp] = await canvas.evaluate((c) => [c.dataset.advice ?? '', c.dataset.hopp ?? '']);
    if (hopp) { await page.mouse.click(box.x + box.width / 2, box.y + box.height / 3); continue; }
    if (advice && (await page.locator(`[data-pace="${advice}"]`).getAttribute('aria-pressed')) !== 'true') await page.locator(`[data-pace="${advice}"]`).tap();
  }
  await expect(end).toContainText(/Ohne Fehler und genau in der Zielzeit!|Fehler\. Kiwi hat trotzdem geübt\./);
  const after = await kiwi();
  expect(after.skills.crossCountry).toBeGreaterThan(before.skills.crossCountry);
  expect(after.needs.energy).toBe(before.needs.energy - DATA.crossCountry.energy);
  await page.getByRole('button', { name: t.toFarm }).tap();
  await expect(page.getByRole('button', { name: t.places.arena })).toBeVisible();
});

test('the pasture: places for every horse, enlarged step by step; a horse that does not fit on it says so at the market', async ({ page }) => {
  await page.goto('./');
  await newGame(page, 'Sonnenhof');
  // a Reitschule with money, two ponies (2 of 4 places) and a big horse already bought (4 of 4)
  await changeSave(page, (s) => {
    Object.assign(s, { stage: 'reitschule', money: 2000 });
    (s.built as { stalls: number }).stalls = 1;
    const horses = s.horses as { id: string; name: string; breed: string; look: object; log: number[][] }[];
    horses.push({ ...horses[0], id: 'big', name: 'Bruno', breed: 'warmblut', look: { build: 'horse', coat: 'brauner' } });
    s.market = [{ id: 'nugget', name: 'Nugget', breed: 'haflinger', look: { build: 'pony', coat: 'fuchs' }, price: 300 }];
  });
  await expect(page.getByRole('button', { name: t.pastureLabel(4, DATA.pasture.start) })).toBeVisible();
  // the market: a stall is free, but the pasture is full
  await page.getByRole('button', { name: t.places.board }).tap();
  await expect(page.locator('[data-offer="nugget"]')).toBeDisabled();
  await expect(page.locator('[data-offer="nugget"]')).toContainText(t.pastureFullShort);
  await expect(page.getByText(t.pastureFull)).toBeVisible();
  await page.getByRole('button', { name: t.close }).tap();
  // on the pasture: enlarge it, then the pony can come
  await page.getByRole('button', { name: t.pastureLabel(4, DATA.pasture.start) }).tap();
  await expect(page.locator('#use')).toHaveText(t.pastureUse(4, DATA.pasture.start));
  await page.getByRole('button', { name: t.pastureGrow(DATA.build.pasture.places, DATA.build.pasture.cost) }).tap();
  await expect(page.getByText(t.pastureGrown)).toBeVisible();
  await page.getByRole('button', { name: t.gotIt }).tap();
  await expect(page.locator('#use')).toHaveText(t.pastureUse(4, DATA.pasture.start + DATA.build.pasture.places));
  await page.getByRole('button', { name: t.toFarm }).tap();
  await page.getByRole('button', { name: t.places.board }).tap();
  await page.locator('[data-offer="nugget"]').tap();
  await expect(page.getByText(t.boughtHorse('Nugget'))).toBeVisible();
});

test('the care course from the stable: a step out of turn: Oma says why; every step done, the pony is groomed and happier', async ({ page }) => {
  test.setTimeout(120_000);
  await page.goto('./');
  await newGame(page, 'Sonnenhof');
  const kiwi = () => page.evaluate(() => JSON.parse(localStorage.getItem('hufgeklapper.slot.0')!).state.horses[0]);
  const before = await kiwi();
  await page.getByRole('button', { name: t.places.stall }).tap();
  await page.locator('.nameplate[data-horse="kiwi"]').tap();
  await page.getByRole('button', { name: t.routine }).tap();
  await expect(page.locator('#say')).toHaveText(t.routineIntro('Kiwi'));
  // tied up before it is out of the box: Oma says what comes first
  await page.getByRole('button', { name: t.things.rope, exact: true }).tap();
  const ring = (JSON.parse((await page.locator('#routine').getAttribute('data-spots'))!).ring as string).split(',').map(Number);
  await page.mouse.click(ring[0], ring[1]);
  await expect(page.locator('#say')).toHaveText(t.routineFirst(t.steps.open));
  await playRoutine(page);
  await expect(page.locator('#routine-end')).toContainText(t.routineDone('Kiwi', false));
  const after = await kiwi();
  expect(after.cared).toEqual(['groom', 'hooves']);
  expect(after.needs.happy).toBeGreaterThan(before.needs.happy);
  expect(after.needs.energy).toBe(before.needs.energy - DATA.routine.energy);
  await page.getByRole('button', { name: t.toStable }).tap();
  await expect(page.locator('.nameplate[data-horse="kiwi"]')).toBeVisible();
});

test('jumping practice: the avatar draws the way round the course, a tap takes off, the pony trains', async ({ page }) => {
  test.setTimeout(60_000); // the round runs in real time (about 12 s), slower on a busy runner
  await page.goto('./');
  await newGame(page, 'Sonnenhof');
  const kiwi = () => page.evaluate(() => JSON.parse(localStorage.getItem('hufgeklapper.slot.0')!).state.horses[0]);
  const before = await kiwi();
  await page.getByRole('button', { name: t.places.arena }).tap();
  await page.getByRole('button', { name: t.practiseJumping }).tap();
  await page.getByRole('button', { name: 'Kiwi' }).tap();
  await expect(page.getByText(t.jumpHow(true))).toBeVisible();
  await page.getByRole('button', { name: t.go }).tap();
  // steered round the course with "Hopp!" at the green patches: the round ends with the result
  const end = page.locator('#jump-end');
  // each round has its own course: 6 jumps for practice, the clock at 0
  const hud = page.locator('#jump-hud'), start = new RegExp(`^${t.jumpHud(1, DATA.jumping.courses.E.jumps.length, 0, 0, 0).split(' · Zeit')[0]} · Zeit 0/`);
  await expect(hud).toHaveText(start);
  // the pony waits until a way is drawn: the tip says so, and the clock stands
  await expect(page.locator('#jump-tip')).toHaveText(t.drawTip('first', true));
  await page.waitForTimeout(1500);
  await expect(hud).toHaveText(start);
  // a short first way: the pony rides it and stands again; while the next way is drawn it still waits, until the
  // finger lifts
  const canvas = page.locator('#jumping'), tip = page.locator('#jump-tip');
  const routeNow = async () => (await canvas.getAttribute('data-route'))!.split(' ').map((p) => p.split(',').map(Number));
  const draw = async (points: number[][]) => { await page.mouse.move(points[0][0], points[0][1]); await page.mouse.down(); for (const [x, y] of points.slice(1)) await page.mouse.move(x, y); };
  await draw((await routeNow()).slice(0, 3));
  await page.mouse.up();
  await expect(tip).toHaveText(t.drawTip('more', true), { timeout: 5000 });
  const way = (await canvas.getAttribute('data-route'))!;
  await draw((await routeNow()).slice(0, 3));
  await page.waitForTimeout(1000);
  await expect(tip).toHaveText(t.drawTip('more', true)); // still standing: the finger is down
  await expect(canvas).toHaveAttribute('data-route', way); // (a horse that moved gets a new route)
  await page.mouse.up();
  await expect(tip).toBeHidden(); // off it goes
  await rideCourse(page);
  await expect(end).toContainText(/Fehlerfrei! Kiwi springt jetzt besser\.|Fehler\. Kiwi hat trotzdem geübt\./);
  const after = await kiwi();
  expect(after.skills.jumping).toBeGreaterThan(before.skills.jumping);
  expect(after.needs.energy).toBe(before.needs.energy - DATA.jumping.energy);
  // how much it grew, out of what a Haflinger can reach
  await expect(end).toContainText(t.skillGain(t.jumping, after.skills.jumping - before.skills.jumping, after.skills.jumping, DATA.jumping.scope.haflinger));
  await page.getByRole('button', { name: t.toFarm }).tap();
  await expect(page.getByRole('button', { name: t.places.arena })).toBeVisible();
  // the progress shows on the horse card, in the comparison of all horses, and in tonight's diary
  await page.getByRole('button', { name: t.places.stall }).tap();
  await page.locator('.nameplate[data-horse="kiwi"]').tap();
  await expect(page.locator('#card .progress')).toContainText(t.weekGain(after.skills.jumping - 10, 0));
  await page.getByRole('button', { name: t.close }).tap();
  await page.getByRole('button', { name: t.compare, exact: true }).tap();
  await expect(page.locator('.sheet.compare')).toContainText(t.thisWeek(after.skills.jumping - 10, false));
  await page.getByRole('button', { name: t.close }).tap();
  await page.getByRole('button', { name: t.sleep }).tap();
  await expect(page.getByText(t.diaryGain('Kiwi', after.skills.jumping - 10, 0))).toBeVisible();
});

test('riding badge 1: Oma asks five questions, a jumping round, then the rosette or another try tomorrow', async ({ page }) => {
  test.setTimeout(60_000);
  await page.goto('./');
  await newGame(page, 'Sonnenhof');
  // not open before practice
  await page.getByRole('button', { name: t.places.arena }).tap();
  await expect(page.getByRole('button', { name: t.ridingBadge })).toBeDisabled();
  await expect(page.getByText(t.badgeWaits.practise(DATA.badge.trainings))).toBeVisible();
  // as if practised enough: the save says so, and the game carries on from it
  await changeSave(page, (s) => { s.trainings = DATA.badge.trainings; });
  await page.getByRole('button', { name: t.places.arena }).tap();
  await page.getByRole('button', { name: t.ridingBadge }).tap();
  await expect(page.getByText(t.badgeIntro)).toBeVisible();
  await page.getByRole('button', { name: t.next }).tap();
  for (const q of t.quiz) {
    await expect(page.getByText(q.q)).toBeVisible();
    await page.getByRole('button', { name: q.a[0].text }).tap();
    await expect(page.getByText(t.quizRight)).toBeVisible();
    await page.getByRole('button', { name: t.next }).tap();
  }
  await expect(page.getByText(t.quizDone(5))).toBeVisible();
  await page.getByRole('button', { name: 'Kiwi' }).tap();
  await page.getByRole('button', { name: t.go }).tap();
  const end = page.locator('#jump-end');
  await rideCourse(page);
  // passed or not (the taps are timed, a pole may still fall), the result and the save agree
  await expect(end).toBeVisible({ timeout: 15_000 });
  const passed = (await end.textContent())!.includes(t.badgePassed);
  if (!passed) await expect(end).toContainText(t.badgeFailed);
  const state = await page.evaluate(() => JSON.parse(localStorage.getItem('hufgeklapper.slot.0')!).state);
  expect(state.badges).toBe(passed ? 1 : 0);
  await page.getByRole('button', { name: t.toFarm }).tap();
  // the player card shows the figure's name and the badge, if earned
  await page.getByRole('button', { name: t.menu }).tap();
  await page.getByRole('button', { name: t.playerCard }).tap();
  await expect(page.locator('#player-card')).toContainText(passed ? t.badgeName : t.noBadges);
});

test('a jumping show: entry fee, one round, the podium with prize money; the next show in three days', async ({ page }) => {
  test.setTimeout(60_000);
  await page.goto('./');
  await newGame(page, 'Sonnenhof');
  // as if the badge were passed and it is show day
  await changeSave(page, (s) => { Object.assign(s, { badges: 1, trainings: 3, day: DATA.shows.every }); });
  // the notice board's calendar names today
  await page.getByRole('button', { name: t.places.board }).tap();
  await expect(page.getByText(t.nextShow(DATA.shows.every, true))).toBeVisible();
  await page.getByRole('button', { name: t.close }).tap();
  await page.getByRole('button', { name: t.places.arena }).tap();
  await page.getByRole('button', { name: t.show, exact: true }).tap();
  await expect(page.getByText(t.showEnter(DATA.shows.classes.E.fee))).toBeVisible();
  await page.getByRole('button', { name: 'Kiwi' }).tap();
  await page.getByRole('button', { name: t.go }).tap();
  await rideCourse(page);
  const end = page.locator('#jump-end');
  await expect(end.getByRole('heading', { name: t.podium })).toBeVisible({ timeout: 15_000 });
  await expect(end.locator('.ranking li')).toHaveCount(DATA.shows.rivalsPerShow + 1);
  await expect(end.locator('.ranking .you')).toHaveCount(1);
  // the money moved as the bill says: the fee out, a prize in if placed
  const s = await page.evaluate(() => JSON.parse(localStorage.getItem('hufgeklapper.slot.0')!).state);
  const prize = s.today.find((e: { what: string }) => e.what === 'prize')?.amount ?? 0;
  expect(s.money).toBe(300 - DATA.shows.classes.E.fee + prize);
  await expect(end).toContainText(prize ? `+${prize} € Preisgeld` : 'Beim nächsten Turnier');
  await page.getByRole('button', { name: t.toFarm }).tap();
  await page.getByRole('button', { name: t.places.arena }).tap();
  await expect(page.getByRole('button', { name: t.show, exact: true })).toBeDisabled();
  await expect(page.getByText(t.showWaits.notToday(2 * DATA.shows.every))).toBeVisible();
});

test('show classes: a trained horse opens class A; the untrained one may not start there; class A\'s fee', async ({ page }) => {
  test.setTimeout(60_000);
  await page.goto('./');
  await newGame(page, 'Sonnenhof');
  const A = DATA.shows.classes.A;
  await changeSave(page, (s) => {
    Object.assign(s, { badges: 1, trainings: 3, day: DATA.shows.every });
    (s.horses as { name: string; skills: { jumping: number } }[]).find((h) => h.name === 'Kiwi')!.skills.jumping = A.minSkill;
  });
  await page.getByRole('button', { name: t.places.arena }).tap();
  await page.getByRole('button', { name: t.show, exact: true }).tap();
  await expect(page.getByText(t.classesHow)).toBeVisible();
  await expect(page.getByRole('button', { name: t.showClass('E', DATA.shows.classes.E.fee, DATA.shows.classes.E.prizes[0]) })).toBeEnabled();
  await expect(page.getByRole('button', { name: t.showClass('L', DATA.shows.classes.L.fee, DATA.shows.classes.L.prizes[0]) })).toBeDisabled();
  await page.getByRole('button', { name: t.showClass('A', A.fee, A.prizes[0]) }).tap();
  await expect(page.getByText(t.showEnterClass('A', A.fee))).toBeVisible();
  await expect(page.getByRole('button', { name: `Luna · ${t.notSkilled}` })).toBeDisabled();
  await page.getByRole('button', { name: 'Kiwi' }).tap();
  await page.getByRole('button', { name: t.go }).tap();
  await rideCourse(page);
  // held for momentum and let go on time: the rider clears (nearly) every higher jump
  expect(Number((await page.locator('#jump-hud').textContent())!.match(/Fehler (\d+)/)![1])).toBeLessThanOrEqual(1);
  await expect(page.locator('#jump-end').getByRole('heading', { name: t.podium })).toBeVisible({ timeout: 15_000 });
  const s = await page.evaluate(() => JSON.parse(localStorage.getItem('hufgeklapper.slot.0')!).state);
  expect(s.today[0]).toEqual({ what: 'showFee', amount: -A.fee });
});

test('the task list and Oma Hanne: she explains a place once, and says when a pony is hungry', async ({ page }) => {
  await page.goto('./');
  await newGame(page, 'Sonnenhof', true);
  // the task list, open; it folds away
  const toggle = page.getByRole('button', { name: t.goalsTitle(0, 5) });
  await expect(toggle).toHaveAttribute('aria-expanded', 'true');
  await expect(page.getByText(t.goalText.lessons(DATA.goals.kleinerHof[1].need))).toBeVisible();
  await toggle.tap();
  await expect(page.getByText(t.goalText.lessons(DATA.goals.kleinerHof[1].need))).toBeHidden();
  // the first visit to the stable: Oma explains it; the second time she doesn't
  await page.getByRole('button', { name: t.places.stall }).tap();
  await expect(page.getByText(t.explain.stable)).toBeVisible();
  await page.getByRole('button', { name: t.gotIt }).tap();
  await page.getByRole('button', { name: t.toFarm }).tap();
  await page.getByRole('button', { name: t.places.stall }).tap();
  await expect(page.locator('.nameplate', { hasText: 'Kiwi' })).toBeVisible();
  await expect(page.getByText(t.explain.stable)).toBeHidden();
  // a hungry pony: one hint on the farm, which the child can close
  await changeSave(page, (s) => { (s.horses as { needs: { fed: number } }[])[0].needs.fed = 10; });
  await expect(page.getByText(t.hints.hungry('Kiwi'))).toBeVisible();
  // neither the hint nor the open task list covers a place the child must tap (once the labels are placed)
  await expect(page.getByRole('button', { name: t.places.stall })).toBeVisible();
  const covered = await page.evaluate(() => {
    const boxes = ['#hint', '.goals'].map((q) => document.querySelector(q)!.getBoundingClientRect());
    return [...document.querySelectorAll<HTMLElement>('.label')].filter((l) => {
      const r = l.getBoundingClientRect();
      return boxes.some((b) => r.left < b.right && r.right > b.left && r.top < b.bottom && r.bottom > b.top);
    }).map((l) => l.textContent);
  });
  expect(covered).toEqual([]);
  await page.getByRole('button', { name: t.closeHint }).tap();
  await expect(page.getByText(t.hints.hungry('Kiwi'))).toBeHidden();
  // the notice board: Oma explains it first, then the shop opens
  await page.getByRole('button', { name: t.places.board }).tap();
  await expect(page.getByText(t.explain.board)).toBeVisible();
  await page.getByRole('button', { name: t.gotIt }).tap();
  await expect(page.getByRole('heading', { name: t.shopTitle })).toBeVisible();
});

test('the farm inspection makes a Reitschule: buy a horse into the free stall, build stall places, upgrade the arena', async ({ page }) => {
  await page.goto('./');
  await newGame(page, 'Sonnenhof');
  // as if every goal of the Kleiner Hof were met and money saved up
  await changeSave(page, (s) => { Object.assign(s, { goalsDone: ['groom', 'lessons', 'badge', 'savings', 'reputation'], money: 2000 }); });
  await page.getByRole('button', { name: t.startInspection }).tap();
  await expect(page.getByText(t.inspectionIntro)).toBeVisible();
  await expect(page.getByRole('img', { name: t.inspector })).toBeVisible();
  await page.getByRole('button', { name: t.next }).tap();
  for (const q of t.inspectionQuiz) {
    await expect(page.getByText(q.q)).toBeVisible();
    await page.getByRole('button', { name: q.a[0].text }).tap();
    await page.getByRole('button', { name: t.next }).tap();
  }
  await expect(page.getByText(t.inspectionPassed)).toBeVisible();
  await page.getByRole('button', { name: t.toFarm }).tap();
  // the Reitschule's new goals
  await expect(page.getByText(t.goalText.horses(3))).toBeVisible();
  // the market: the Reitschule has a free stall, so a horse can move in at once
  await page.getByRole('button', { name: t.places.board }).tap();
  await expect(page.getByRole('heading', { name: t.market })).toBeVisible();
  await expect(page.locator('[data-offer]')).toHaveCount(DATA.market.offers);
  const offer = page.locator('[data-offer]').first(), name = (await offer.textContent())!.split(' · ')[0];
  await offer.tap();
  await expect(page.getByText(t.boughtHorse(name))).toBeVisible();
  await page.getByRole('button', { name: t.gotIt }).tap();
  const state = await page.evaluate(() => JSON.parse(localStorage.getItem('hufgeklapper.slot.0')!).state);
  expect(state.horses.map((h: { name: string }) => h.name)).toEqual(['Kiwi', 'Luna', name]);
  // now every stall is taken: no more horses until stall places are built
  await page.getByRole('button', { name: t.places.board }).tap();
  await expect(page.locator('[data-offer]').first()).toBeDisabled();
  await page.getByRole('button', { name: t.close }).tap();
  // build two stall places on the free plot
  await page.getByRole('button', { name: t.places.free }).tap();
  await page.getByRole('button', { name: t.buildStalls(DATA.build.stalls.cost) }).tap();
  await expect(page.getByText(t.builtStalls)).toBeVisible();
  await page.getByRole('button', { name: t.gotIt }).tap();
  await expect(page.getByRole('button', { name: t.shelter })).toBeVisible();
  // the stable now has five places: three horses and two free
  await page.getByRole('button', { name: t.places.stall, exact: true }).tap();
  await expect(page.locator('.nameplate:not(.empty)')).toHaveCount(3);
  await expect(page.locator('.nameplate.empty')).toHaveCount(2);
  await page.screenshot({ path: test.info().outputPath('stable-five.png') });
  await page.getByRole('button', { name: t.toFarm }).tap();
  // the arena upgrade
  await page.getByRole('button', { name: t.places.arena }).tap();
  await page.getByRole('button', { name: t.upgradeArena(DATA.build.arena.cost) }).tap();
  await page.getByRole('button', { name: t.upgradeArena(DATA.build.arena.cost) }).tap();
  await expect(page.getByText(t.builtArena)).toBeVisible();
});

test('the second inspection makes a Pensionsstall: a groom, a boarder in the stable, both in the diary and the morning', async ({ page }) => {
  test.setTimeout(60_000);
  await page.goto('./');
  await newGame(page, 'Sonnenhof');
  // as if the Reitschule's goals were all met
  await changeSave(page, (s) => { Object.assign(s, { stage: 'reitschule', goalsDone: DATA.goals.reitschule.map((g) => g.id), money: 2000 }); });
  await page.getByRole('button', { name: t.startInspection }).tap();
  await expect(page.getByText(t.inspectionIntro2)).toBeVisible();
  await page.getByRole('button', { name: t.next }).tap();
  for (const q of t.inspectionQuiz2) {
    await expect(page.getByText(q.q)).toBeVisible();
    await page.getByRole('button', { name: q.a[0].text }).tap();
    await page.getByRole('button', { name: t.next }).tap();
  }
  await expect(page.getByText(t.inspectionPassed2)).toBeVisible();
  await page.getByRole('button', { name: t.toFarm }).tap();
  await expect(page.getByText(t.goalText.boarders(2))).toBeVisible();
  // the notice board: hire a groom, take in a boarder
  await page.getByRole('button', { name: t.places.board }).tap();
  await page.getByRole('button', { name: t.hire(DATA.staff.names[0], DATA.staff.wage, DATA.staff.horses) }).tap();
  await expect(page.getByRole('button', { name: t.fire(DATA.staff.names[0]) })).toBeVisible();
  await page.screenshot({ path: test.info().outputPath('pension-board.png') });
  const offer = page.locator('[data-board]').first(), horse = (await offer.textContent())!.split(' · ')[1].split(' (')[0];
  await offer.tap();
  await page.getByRole('button', { name: t.close }).tap();
  // two more stall places on the free plot: seven in all
  await page.getByRole('button', { name: t.places.free }).tap();
  await page.getByRole('button', { name: t.buildStalls(DATA.build.stalls.cost) }).tap();
  await page.getByRole('button', { name: t.gotIt }).tap();
  // the boarder's horse in the stable, a guest
  await page.getByRole('button', { name: t.places.stall, exact: true }).tap();
  await expect(page.locator('.nameplate.guest', { hasText: horse })).toBeVisible();
  await expect(page.locator('.box')).toHaveCount(DATA.stalls.pensionsstall + DATA.build.stalls.places);
  await page.screenshot({ path: test.info().outputPath('stable-seven.png') });
  await page.locator('.nameplate.guest', { hasText: horse }).tap();
  await expect(page.locator('.horse-card')).toContainText('zahlt');
  await page.getByRole('button', { name: t.close }).tap();
  // a night: the groom is paid and cares, the boarder pays (no morning news for that); the next day's diary shows both
  await page.getByRole('button', { name: t.sleep }).tap();
  await page.getByRole('button', { name: t.goodNight }).tap(); // the diary: the stall places built
  await expect(page.locator('#day')).toHaveText(t.day(2), { timeout: 5000 });
  await page.getByRole('button', { name: t.sleep }).tap();
  const diary = page.locator('.diary');
  await expect(diary.locator('.diary-row', { hasText: t.billWhat.wage })).toContainText(t.euros(-DATA.staff.wage));
  await expect(diary.locator('.diary-row', { hasText: t.billWhat.board })).toBeVisible();
});

test('the credits name the artists and close again', async ({ page }) => {
  await page.goto('./');
  await page.getByRole('button', { name: t.credits }).tap();
  await expect(page.getByRole('heading', { name: t.creditsTitle })).toBeVisible();
  await expect(page.getByText('[LPC] Horses', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: t.back }).tap();
  await expect(page.getByRole('heading', { name: t.creditsTitle })).toBeHidden();
});

test('a home-screen app: manifest with icons, and the game runs offline once loaded', async ({ page, context }) => {
  await page.goto('./');
  const href = await page.locator('link[rel="manifest"]').getAttribute('href');
  const manifest = await (await page.request.get(href!)).json();
  expect(manifest).toMatchObject({ name: t.title, display: 'fullscreen', orientation: 'landscape' });
  for (const i of manifest.icons) expect((await page.request.get(new URL(i.src, new URL(href!, page.url())).href)).ok()).toBe(true);
  // the service worker has cached the game: offline, it still starts, draws the farm and plays
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);
  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole('heading', { name: t.title })).toBeVisible();
  const farm = page.locator('#farm');
  await expect.poll(() => farm.evaluate((c: HTMLCanvasElement) => c.getContext('2d')!.getImageData(c.width >> 1, c.height >> 1, 1, 1).data[3])).toBe(255);
  await newGame(page, 'Offlinehof');
  await page.getByRole('button', { name: t.places.stall }).tap();
  await expect(page.locator('.nameplate', { hasText: 'Kiwi' })).toBeVisible();
  await expect.poll(() => page.locator('#stable').evaluate((c: HTMLCanvasElement) => c.getContext('2d')!.getImageData(c.width >> 1, c.height >> 1, 1, 1).data[3])).toBe(255);
});

test('portrait asks to turn the iPad', async ({ page }) => {
  await page.setViewportSize({ width: 820, height: 1180 });
  await page.goto('./');
  await expect(page.getByText(t.rotate)).toBeVisible();
  await expect(page.getByRole('button', { name: t.start })).toBeHidden();
});
