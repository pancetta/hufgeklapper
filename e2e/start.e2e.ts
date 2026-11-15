import { expect, test } from '@playwright/test';
import { t } from '../src/strings';

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
  await page.getByRole('button', { name: t.start }).tap();
  // the farm map with the top bar
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

test('tapping the barn itself opens the stable, and nothing in it', async ({ page }) => {
  await page.goto('./');
  await page.getByRole('button', { name: t.start }).tap();
  const label = (await page.getByRole('button', { name: t.places.stall }).boundingBox())!;
  // the barn's doors, above its label: a tap on the canvas, where the stable's horse buttons will appear
  await page.touchscreen.tap(label.x + label.width / 2, label.y - 60);
  await expect(page.locator('.nameplate', { hasText: 'Kiwi' })).toBeVisible();
  await page.waitForTimeout(400);
  await expect(page.locator('#card')).toBeHidden();
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
