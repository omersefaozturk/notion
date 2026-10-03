import { expect, test } from '@playwright/test';
import { comingWeekend, login, monthCell, OMER, openMonth, setScope } from './helpers';

test.use({ viewport: { width: 390, height: 844 }, hasTouch: true });

test('phone: month cells show owner letters; tapping a day opens its agenda', async ({ page }) => {
  await login(page, OMER);
  await setScope(page, 'Ortak');
  const { sun } = comingWeekend();
  await openMonth(page, sun);
  const cell = monthCell(page, sun);
  // compact letters for both spouses
  await expect(cell.getByLabel('Ömer').first()).toHaveText('Ö');
  await expect(cell.getByLabel('Eşim').first()).toHaveText('E');
  await cell.click({ position: { x: 20, y: 50 } });
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByRole('button', { name: /Piknik/ })).toBeVisible();
  await expect(dialog.getByRole('button', { name: /Bisiklet turu/ })).toBeVisible();
  // the sidebar opens from the menu button
  await dialog.getByRole('button', { name: 'Kapat' }).click();
  await page.getByRole('button', { name: 'Menüyü aç' }).click();
  await page.getByRole('link', { name: /Pano/ }).click();
  await expect(page.getByTestId('column-todo')).toBeVisible();
});
