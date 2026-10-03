import { expect, test } from '@playwright/test';
import { ES, loggedInPage, login, OMER, uniq } from './helpers';

const TABS = [
  { tab: 'Günlük', noun: 'günlük' },
  { tab: 'Haftalık', noun: 'haftalık' },
  { tab: 'Aylık', noun: 'aylık' },
] as const;

test('daily / weekly / monthly goals: create and track progress', async ({ page, browser }) => {
  const id = uniq();
  await login(page, OMER);
  await page.goto('/goals');

  for (const { tab, noun } of TABS) {
    await page.getByRole('tab', { name: tab, exact: true }).click();
    const title = `${tab} hedef ${id}`;
    const input = page.getByPlaceholder(`Yeni ${noun} hedef ekle… (Enter)`);
    await input.fill(title);
    await input.press('Enter');
    const card = page.getByTestId('goal-card').filter({ hasText: title });
    await expect(card).toBeVisible();
    await expect(card).toContainText('%0');
    await expect(card.getByLabel('Ömer')).toHaveText('Ö');

    // progress with the keyboard on the slider (step 5)
    const slider = card.getByRole('slider', { name: 'İlerleme' });
    await slider.focus();
    for (let i = 0; i < 10; i++) await slider.press('ArrowRight');
    await expect(card).toContainText('%50');
  }

  // persisted after reload
  await page.reload();
  for (const { tab } of TABS) {
    await page.getByRole('tab', { name: tab, exact: true }).click();
    const card = page.getByTestId('goal-card').filter({ hasText: `${tab} hedef ${id}` });
    await expect(card).toContainText('%50');
  }

  // marking done sets 100 %
  await page.getByRole('tab', { name: 'Aylık', exact: true }).click();
  const monthly = page.getByTestId('goal-card').filter({ hasText: `Aylık hedef ${id}` });
  await monthly.getByRole('checkbox', { name: 'Tamamlandı' }).click();
  await expect(monthly).toContainText('%100');
  await page.reload();
  await expect(monthly.getByRole('checkbox', { name: 'Tamamlandı' })).toHaveAttribute('aria-checked', 'true');

  // the partner sees the shared goal (with Ö badge) and may update its progress
  const es = await loggedInPage(browser, ES);
  await es.goto('/goals');
  await es.getByRole('tab', { name: 'Haftalık', exact: true }).click();
  const shared = es.getByTestId('goal-card').filter({ hasText: `Haftalık hedef ${id}` });
  await expect(shared.getByLabel('Ömer')).toHaveText('Ö');
  const slider = shared.getByRole('slider', { name: 'İlerleme' });
  await slider.focus();
  await slider.press('ArrowRight');
  await expect(shared).toContainText('%55');
  await page.getByRole('tab', { name: 'Haftalık', exact: true }).click();
  await page.reload();
  await expect(page.getByTestId('goal-card').filter({ hasText: `Haftalık hedef ${id}` })).toContainText('%55');
  await es.context().close();
});
