import { expect, type Page, test } from '@playwright/test';
import { DATA } from '../src/sim/data';
import { timeAllowed } from '../src/sim/round';
import { t } from '../src/strings';

/**
 * Rides the course like a rider who knows the way: draws the path with one finger towards the point the scene says
 * (its autopilot), lifts it and taps once for "Hopp!" when it says so, until the round's result shows.
 */
async function rideCourse(page: Page) {
  const canvas = page.locator('#jumping'), end = page.locator('#jump-end'), until = Date.now() + 40_000;
  let down = false;
  while (await end.isHidden()) {
    if (Date.now() > until) throw new Error(`the round did not end in 40 s: the autopilot is lost (${await page.locator('#jump-hud').textContent()})`);
    const [aim, hopp] = await canvas.evaluate((c) => [c.dataset.aim ?? '', c.dataset.hopp ?? '']);
    if (!aim) continue; // the first frame of the round is still to come
    const [x, y] = aim.split(',').map(Number);
    if (hopp) {
      if (down) { await page.mouse.up(); down = false; }
      await page.mouse.click(x, y); // a tap: "Hopp!"
      continue;
    }
    // a stroke starts a little off the target, so it is drawing (not a tap) even when the target stands still
    if (!down) { await page.mouse.move(x - 20, y - 20); await page.mouse.down(); await page.mouse.move(x, y, { steps: 2 }); down = true; }
    else await page.mouse.move(x, y, { steps: 2 });
  }
  if (down) await page.mouse.up();
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
  if (!explain) await changeSave(page, (s) => { s.explained = ['stable', 'care', 'board', 'arena']; });
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
  // the notice board sells hay
  await page.getByRole('button', { name: t.places.board }).tap();
  await page.getByRole('button', { name: t.hayPack(5, 25) }).tap();
  await expect(page.getByRole('status')).toHaveText(t.bought(5));
  await expect(page.locator('#hay')).toHaveText(t.hay(15));
  await expect(page.locator('#money')).toHaveText(t.money(275));
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
  await expect(page.locator('#day')).toHaveText(t.day(2), { timeout: 5000 });
  expect(Number(await page.getByRole('meter', { name: t.needs.fed }).first().getAttribute('aria-valuenow'))).toBeLessThan(before);
  // the morning bill shows yesterday's hay
  await expect(page.getByText(`${t.billWhat.hay} ${t.euros(-25)}`)).toBeVisible();
  await page.getByRole('button', { name: t.morningGo }).tap();
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
  // a night without hay: the morning says so
  await page.getByRole('button', { name: t.sleep }).tap();
  await expect(page.getByText(t.newsNoHay)).toBeVisible({ timeout: 5000 });
  await page.getByRole('button', { name: t.morningGo }).tap();
  await expect(page.getByText(t.newsNoHay)).toBeHidden();
});

test('caring for a pony with gestures: brush, hooves, hay, manure; quick care after five times', async ({ page }) => {
  await page.goto('./');
  await newGame(page, 'Pflegehof');
  await page.getByRole('button', { name: t.places.stall }).tap();
  await page.locator('.nameplate', { hasText: 'Kiwi' }).tap();
  await page.getByRole('button', { name: t.care }).tap();
  await expect(page.getByText(t.careTitle('Kiwi'))).toBeVisible();
  await page.waitForTimeout(600); // the scene loads
  // the scene's layout, as the care scene computes it (logical pixels, scale S)
  const g = await page.locator('#care-scene').evaluate((c: HTMLCanvasElement) => {
    const r = c.getBoundingClientRect();
    return { left: r.left, top: r.top, S: r.width / c.width, W: c.width, H: c.height };
  });
  const foot = Math.round(g.H * 0.72), cx = Math.round(g.W * 0.36);
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
  // hay: drag the bale from the corner into the manger
  await page.getByRole('button', { name: t.tools.feed }).tap();
  await page.mouse.move(...at(24, 40)); await page.mouse.down();
  await page.mouse.move(...at(Math.round(g.W * 0.62) + 39, foot - 16), { steps: 15 }); await page.mouse.up();
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
  await page.getByRole('button', { name: t.care }).tap();
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
  await page.getByRole('button', { name: t.places.board }).tap();
  await expect(page.getByText(t.omaCredit)).toBeVisible();
  await page.getByRole('button', { name: t.hayPackCredit(10, 45) }).tap();
  await expect(page.locator('#hay')).toHaveText(t.hay(20));
  await expect(page.getByText(t.owe(45))).toBeVisible();
  await page.getByRole('button', { name: t.loan(100) }).tap();
  await expect(page.locator('#money')).toHaveText(t.money(100));
});

test('a riding lesson: a pupil waits by the arena, picks a pony, rides a round and pays', async ({ page }) => {
  await page.goto('./');
  await newGame(page, 'Sonnenhof');
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
  await page.locator('#lesson [data-horse="kiwi"]').tap();
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
  await expect(page.locator('#jump-hud')).toHaveText(t.jumpHud(1, DATA.jumping.courses.E.jumps.length, 0, 0, timeAllowed(DATA.jumping.courses.E)));
  await rideCourse(page);
  await expect(end).toContainText(/Fehlerfrei! Kiwi springt jetzt besser\.|Fehler\. Kiwi hat trotzdem geübt\./);
  const after = await kiwi();
  expect(after.skills.jumping).toBeGreaterThan(before.skills.jumping);
  expect(after.needs.energy).toBe(before.needs.energy - DATA.jumping.energy);
  await page.getByRole('button', { name: t.toFarm }).tap();
  await expect(page.getByRole('button', { name: t.places.arena })).toBeVisible();
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
