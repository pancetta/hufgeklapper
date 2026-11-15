import { expect, type Page, test } from '@playwright/test';
import { t } from '../src/strings';

/** Starts a new game in the first slot under the given farm name, with the default figure, and listens to Oma Hanne. */
async function newGame(page: Page, name: string) {
  await page.getByRole('region', { name: t.slot(1) }).getByRole('button', { name: t.newGame }).tap();
  await page.getByLabel(t.farmName).fill(name);
  await page.getByRole('button', { name: t.start }).tap();
  for (let i = 0; i < t.intro('', []).length; i++) await page.getByRole('button', { name: t.next }).tap();
  await expect(page.getByRole('button', { name: t.next })).toBeHidden();
}

test('a new game in slot 2: the player makes a figure, Oma Hanne hands over the farm, the slot keeps it', async ({ page }) => {
  await page.goto('./');
  await page.getByRole('region', { name: t.slot(2) }).getByRole('button', { name: t.newGame }).tap();
  await expect(page.getByRole('heading', { name: t.whoAreYou })).toBeVisible();
  await page.getByLabel(t.yourName).fill('Mara');
  await page.getByRole('button', { name: t.hairStyles.zoepfe }).tap();
  await page.getByRole('button', { name: t.colour(t.looks.jacket, 5) }).tap();
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
  await page.locator('#lesson [data-horse="kiwi"]').tap();
  await expect(page.getByRole('status')).toHaveText(t.lessonRuns(name, 'Kiwi'));
  await expect(page.locator('#money')).not.toHaveText(t.money(300));
  await expect(pupil).toHaveCount(0);
  // the round ends with how the pupil liked it
  await expect(page.getByRole('status')).toContainText(`${name} war`, { timeout: 20_000 });
  // nobody else today: the arena says so
  await page.getByRole('button', { name: t.places.arena }).tap();
  await expect(page.getByRole('status')).toHaveText(t.noPupils);
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
