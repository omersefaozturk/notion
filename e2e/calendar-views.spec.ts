import { expect, test } from '@playwright/test';
import { api, chip, istDate, login, OMER, openMonth, setScope, uniq } from './helpers';

/** The 27th of next month: no seeded data lands there. */
function quietDate(): string {
  const t = istDate();
  const [y, m] = t.split('-').map(Number);
  const nm = m === 12 ? 1 : m + 1;
  const ny = m === 12 ? y + 1 : y;
  return `${ny}-${String(nm).padStart(2, '0')}-27`;
}

test('month grid shows events, due tasks and goals; week and day views work', async ({ page }) => {
  const id = uniq();
  const day = quietDate();
  await login(page, OMER);
  await setScope(page, 'Ortak');

  // event via the UI (timed, from the day cell)
  const cell = await openMonth(page, day);
  await cell.click({ position: { x: 30, y: 10 } });
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Başlık').fill(`Doktor ${id}`);
  await dialog.getByRole('checkbox', { name: 'Tüm gün' }).click();
  await dialog.getByLabel('Başlangıç saati').fill('14:00');
  await dialog.getByLabel('Bitiş saati').fill('15:30');
  await dialog.getByRole('button', { name: 'Kaydet' }).click();
  await expect(dialog).toBeHidden();

  // task with due date via the board modal
  await page.goto('/board');
  await page.getByRole('button', { name: '+ Görev' }).click();
  const tdialog = page.getByRole('dialog');
  await tdialog.getByLabel('Başlık').fill(`Fatura öde ${id}`);
  await tdialog.getByLabel('Son tarih').fill(day);
  await tdialog.getByRole('button', { name: 'Kaydet' }).click();
  await expect(tdialog).toBeHidden();

  // goals (daily on the day, weekly + monthly of that period) via the API, partner's daily goal too
  await api(page, 'POST', '/goals', { title: `Günlük hedef ${id}`, period: 'daily', periodStart: day });
  await api(page, 'POST', '/goals', { title: `Haftalık hedef ${id}`, period: 'weekly', periodStart: day });
  await api(page, 'POST', '/goals', { title: `Aylık hedef ${id}`, period: 'monthly', periodStart: day });

  const c = await openMonth(page, day);
  const ev = chip(c, `Doktor ${id}`);
  await expect(ev).toBeVisible();
  await expect(ev).toContainText('14:00');
  await expect(ev.getByLabel('Ömer')).toHaveText('Ö');
  await expect(c.getByTitle(`Görev: Fatura öde ${id}`)).toBeVisible();
  await expect(c.getByTitle(new RegExp(`Hedef: Günlük hedef ${id}`))).toBeVisible();
  // weekly/monthly goals are listed next to the month grid
  const aside = page.locator('aside').filter({ hasText: 'Aylık hedefler' });
  await expect(aside.getByText(`Aylık hedef ${id}`)).toBeVisible();
  await expect(aside.getByText(`Haftalık hedef ${id}`)).toBeVisible();

  // clicking an event opens it
  await ev.click();
  await expect(page.getByRole('dialog').getByLabel('Başlık')).toHaveValue(`Doktor ${id}`);
  await page.getByRole('dialog').getByRole('button', { name: 'İptal' }).click();

  // clicking the day number opens the day view of that date
  await c.getByRole('button', { name: /gününü aç/ }).click();
  await expect(page.getByRole('tab', { name: 'Gün', exact: true })).toHaveAttribute('aria-selected', 'true');
  const timed = page.locator('main').getByRole('button', { name: new RegExp(`Doktor ${id}`) });
  await expect(timed).toContainText('14:00–15:30');
  await expect(page.getByTitle(new RegExp(`Hedef: Günlük hedef ${id}`))).toBeVisible();
  await expect(page.getByTitle(`Görev: Fatura öde ${id}`)).toBeVisible();

  // week view around that day: timed event in the time grid, task in the all-day row
  await page.getByRole('tab', { name: 'Hafta', exact: true }).click();
  await expect(timed).toContainText('14:00–15:30');
  await expect(page.getByTitle(`Görev: Fatura öde ${id}`)).toBeVisible();

  // previous day in day view does not show it
  await page.getByRole('tab', { name: 'Gün', exact: true }).click();
  await expect(timed).toBeVisible();
  await page.getByRole('button', { name: 'Önceki' }).click();
  await expect(timed).toHaveCount(0);
  await page.getByRole('button', { name: 'Sonraki' }).click();
  await expect(timed).toBeVisible();
});
