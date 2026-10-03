import { expect, test, type Page } from '@playwright/test';
import { ES, loggedInPage, login, OMER, uniq } from './helpers';

async function waitSaved(page: Page) {
  await expect(page.getByText('Kaydedildi', { exact: true })).toBeVisible();
}

test('weekly plan: create, edit in the page editor, autosave persists', async ({ page, browser }) => {
  const id = uniq();
  await login(page, OMER);
  await page.goto('/plans');
  await page.getByRole('tab', { name: 'Haftalık', exact: true }).click();
  // Ömer already has a plan for this week (seed) → plan next week
  await page.getByRole('button', { name: 'Sonraki' }).click();
  await page.getByRole('button', { name: '+ Plan oluştur' }).click();
  await expect(page).toHaveURL(/\/pages\/\d+$/);
  const url = page.url();

  // template: heading + three empty to-dos
  const todos = page.locator('[data-block-type="todo"] textarea');
  await expect(todos).toHaveCount(3);
  await todos.nth(0).fill(`Spor ${id}`);
  await todos.nth(1).fill(`Annemleri ara ${id}`);
  await page.locator('[data-block-type="todo"]').nth(0).getByRole('checkbox', { name: 'Tamamlandı' }).click();

  // slash menu → bullet list, Enter → next bullet, Tab → nested
  await todos.nth(2).click();
  await page.keyboard.press('End');
  await page.keyboard.press('Enter');
  await page.keyboard.press('Enter'); // empty to-do → paragraph
  await page.keyboard.type('/madde');
  await page.keyboard.press('Enter');
  await page.keyboard.type(`Üst madde ${id}`);
  await page.keyboard.press('Enter');
  await page.keyboard.type(`Alt madde ${id}`);
  await page.keyboard.press('Tab');
  await expect(page.locator('[data-block-type="bullet"][data-depth="1"] textarea')).toHaveValue(`Alt madde ${id}`);
  await page.keyboard.press('Enter');
  await page.keyboard.press('Shift+Tab');
  await page.keyboard.type(`Yine üst ${id}`);
  await expect(page.locator('[data-block-type="bullet"][data-depth="0"] textarea').last()).toHaveValue(`Yine üst ${id}`);

  // toggle block: open by default, close it → state persists
  await page.keyboard.press('Enter');
  await page.keyboard.press('Enter'); // empty bullet → paragraph
  await page.keyboard.type('/açılır');
  await page.keyboard.press('Enter');
  await page.keyboard.type(`Detaylar ${id}`);
  await page.keyboard.press('Enter'); // first child of the open toggle
  await page.keyboard.type(`Gizli not ${id}`);
  const toggle = page.locator('[data-block-type="toggle"]').last();
  await expect(toggle.locator('textarea').nth(1)).toHaveValue(`Gizli not ${id}`);
  await toggle.getByRole('button', { name: 'Daralt' }).click();
  await expect(toggle.getByRole('button', { name: 'Genişlet' })).toHaveAttribute('aria-expanded', 'false');

  // title edit
  const title = page.getByPlaceholder('Adsız');
  await title.fill(`Haftalık plan ${id}`);
  await waitSaved(page);

  // reload: everything is still there
  await page.reload();
  await expect(page.getByPlaceholder('Adsız')).toHaveValue(`Haftalık plan ${id}`);
  await expect(page.locator('[data-block-type="todo"] textarea').nth(0)).toHaveValue(`Spor ${id}`);
  await expect(page.locator('[data-block-type="todo"]').nth(0).getByRole('checkbox', { name: 'Tamamlandı' })).toHaveAttribute('aria-checked', 'true');
  await expect(page.locator('[data-block-type="todo"] textarea').nth(1)).toHaveValue(`Annemleri ara ${id}`);
  await expect(page.locator('[data-block-type="bullet"][data-depth="1"] textarea')).toHaveValue(`Alt madde ${id}`);
  const t2 = page.locator('[data-block-type="toggle"]').last();
  await expect(t2.getByRole('button', { name: 'Genişlet' })).toHaveAttribute('aria-expanded', 'false');
  await expect(t2.locator('textarea')).toHaveCount(1); // child hidden while collapsed
  await t2.getByRole('button', { name: 'Genişlet' }).click();
  await expect(t2.locator('textarea').nth(1)).toHaveValue(`Gizli not ${id}`);
  await waitSaved(page);
  await page.reload();
  await expect(page.locator('[data-block-type="toggle"]').last().getByRole('button', { name: 'Daralt' })).toBeVisible();

  // the plan is listed under next week's plans
  await page.goto('/plans');
  await page.getByRole('tab', { name: 'Haftalık', exact: true }).click();
  await page.getByRole('button', { name: 'Sonraki' }).click();
  await expect(page.getByRole('link', { name: new RegExp(`Haftalık plan ${id}`) })).toBeVisible();

  // the partner can read the shared plan but not edit it
  const es = await loggedInPage(browser, ES);
  await es.goto(url);
  await expect(es.getByText('Salt okunur')).toBeVisible();
  await expect(es.locator('[data-block-type="todo"] textarea').nth(0)).toHaveValue(`Spor ${id}`);
  await es.context().close();
});
