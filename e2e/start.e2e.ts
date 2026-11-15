import { expect, type Page, test } from '@playwright/test';
import { t } from '../src/strings';

/** Starts a new game in the first slot under the given farm name. */
async function newGame(page: Page, name: string) {
  await page.getByRole('region', { name: t.slot(1) }).getByRole('button', { name: t.newGame }).tap();
  await page.getByLabel(t.farmName).fill(name);
  await page.getByRole('button', { name: t.start }).tap();
}

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
  await page.getByRole('button', { name: t.places.board }).tap();
  await expect(page.getByRole('status')).toHaveText(t.board);
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

test('the credits name the artists and close again', async ({ page }) => {
  await page.goto('./');
  await page.getByRole('button', { name: t.credits }).tap();
  await expect(page.getByRole('heading', { name: t.creditsTitle })).toBeVisible();
  await expect(page.getByText('[LPC] Horses', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: t.back }).tap();
  await expect(page.getByRole('heading', { name: t.creditsTitle })).toBeHidden();
});

test('portrait asks to turn the iPad', async ({ page }) => {
  await page.setViewportSize({ width: 820, height: 1180 });
  await page.goto('./');
  await expect(page.getByText(t.rotate)).toBeVisible();
  await expect(page.getByRole('button', { name: t.start })).toBeHidden();
});
