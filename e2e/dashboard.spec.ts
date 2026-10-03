import { expect, test } from '@playwright/test';
import { api, istDate, login, OMER, setScope, uniq, addDays, weekday } from './helpers';

test('Bugün dashboard shows today / this week / this month', async ({ page }) => {
  const id = uniq();
  const today = istDate();
  await login(page, OMER);
  await setScope(page, 'Ortak');

  const section = (name: string) => page.getByRole('region', { name, exact: true });

  // seeded items relative to today (both spouses, with letters)
  const events = section('Bugünün etkinlikleri');
  await expect(events.getByText('Yoga dersi')).toBeVisible();
  await expect(events.getByText('Spor salonu')).toBeVisible();
  await expect(events.getByLabel('Eşim').first()).toHaveText('E');
  await expect(events.getByLabel('Ömer').first()).toHaveText('Ö');
  await expect(section('Bugünün görevleri').getByText('Market alışverişi')).toBeVisible();
  const goals = section('Hedefler');
  await expect(goals.getByText('10.000 adım yürü')).toBeVisible(); // daily
  await expect(goals.getByText('3 kez spor')).toBeVisible(); // weekly
  await expect(goals.getByText('2 kitap bitir')).toBeVisible(); // monthly
  const plans = section('Planlar');
  await expect(plans.getByText('Aylık Plan')).toBeVisible();
  await expect(plans.getByText('Haftalık Plan').first()).toBeVisible();
  await expect(section('Görev durumu')).toContainText('Yapılacak');

  // add a timed event for today from the dashboard → appears immediately
  await page.getByRole('button', { name: '+ Etkinlik' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Başlık').fill(`Akşam yürüyüşü ${id}`);
  if ((await dialog.getByRole('checkbox', { name: 'Tüm gün' }).getAttribute('aria-checked')) === 'true') {
    await dialog.getByRole('checkbox', { name: 'Tüm gün' }).click();
  }
  await dialog.getByLabel('Başlangıç saati').fill('21:30');
  await dialog.getByLabel('Bitiş saati').fill('22:30');
  await dialog.getByRole('button', { name: 'Kaydet' }).click();
  await expect(events.getByText(`Akşam yürüyüşü ${id}`)).toBeVisible();
  await expect(events.getByText('21:30')).toBeVisible();

  // a late-evening Istanbul event (after 21:00 = next day in UTC) stays on today
  await page.reload();
  await expect(events.getByText(`Akşam yürüyüşü ${id}`)).toBeVisible();

  // this week's upcoming events (when today is not Sunday)
  if (weekday(today) < 6) {
    const tomorrow = addDays(today, 1);
    await api(page, 'POST', '/events', { title: `Yarın ${id}`, start: tomorrow, allDay: true });
    await page.reload();
    await expect(section('Bu haftanın etkinlikleri').getByText(`Yarın ${id}`)).toBeVisible();
  }

  // scope "Benim" hides the partner's items
  await setScope(page, 'Benim');
  await expect(events.getByText('Spor salonu')).toBeVisible();
  await expect(events.getByText('Yoga dersi')).toHaveCount(0);
});
