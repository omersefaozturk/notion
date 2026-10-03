import { expect, test } from '@playwright/test';
import { comingWeekend, login, monthCell, OMER, openMonth, setScope, uniq } from './helpers';

test('a new user registering with the invite code from Ayarlar joins the household', async ({ page, browser }) => {
  const id = uniq();
  await login(page, OMER);
  await page.goto('/settings');
  const code = (await page.getByTestId('invite-code').textContent())!.trim();
  expect(code).toMatch(/^[A-Z0-9]{4,}$/);

  const ctx = await browser.newContext();
  const newbie = await ctx.newPage();
  await newbie.goto('/register');
  await newbie.getByLabel('Ad', { exact: true }).fill('Zeynep');
  await newbie.getByLabel('E-posta').fill(`zeynep-${id}@example.com`);
  await newbie.getByLabel('Şifre').fill('123456');
  await newbie.getByLabel('Baş harf').fill('Z');
  await newbie.getByLabel('Davet kodu (isteğe bağlı)').fill(code.toLowerCase());
  await newbie.getByRole('button', { name: /Kayıt|Hesap/ }).click();
  await expect(newbie).toHaveURL(/\/$/);
  await expect(newbie.getByText('Bizim Ev').first()).toBeVisible();

  // she sees the household's shared plans (Ömer's letter) in the merged calendar
  await setScope(newbie, 'Ortak');
  const { sat } = comingWeekend();
  await openMonth(newbie, sat);
  await expect(monthCell(newbie, sat).getByLabel('Ömer').first()).toHaveText('Ö');
  await monthCell(newbie, sat).getByRole('button', { name: /gününü aç/ }).click();
  await expect(newbie.locator('main').getByRole('button', { name: /Annemlerde kahvaltı/ })).toBeVisible();

  // Ömer's settings now list her as a member, and his calendar legend shows her letter
  await page.reload();
  await expect(page.getByText('Zeynep').first()).toBeVisible();
  await page.goto('/calendar');
  await expect(page.getByTestId('member-legend')).toContainText('Zeynep');
  await ctx.close();
});
