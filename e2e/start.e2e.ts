import { expect, test } from '@playwright/test';
import { t } from '../src/strings';

test('tapping the start button shows the coming-soon note', async ({ page }) => {
  await page.goto('./');
  await expect(page.getByRole('heading', { name: t.title })).toBeVisible();
  await page.getByRole('button', { name: t.start }).tap();
  await expect(page.getByText(t.comingSoon)).toBeVisible();
  await expect(page.getByRole('button', { name: t.start })).toBeHidden();
});

test('portrait asks to turn the iPad', async ({ page }) => {
  await page.setViewportSize({ width: 820, height: 1180 });
  await page.goto('./');
  await expect(page.getByText(t.rotate)).toBeVisible();
  await expect(page.getByRole('button', { name: t.start })).toBeHidden();
});
