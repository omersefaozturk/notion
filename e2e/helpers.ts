import { expect, type Browser, type Locator, type Page } from '@playwright/test';

export const OMER = { email: 'omer@example.com', password: '123456', name: 'Ömer', initial: 'Ö' };
export const ES = { email: 'es@example.com', password: '123456', name: 'Eşim', initial: 'E' };
export const TZ = 'Europe/Istanbul';

/** A short unique suffix so repeated runs never collide. */
export const uniq = () => Math.random().toString(36).slice(2, 7);

/** YYYY-MM-DD for a Date as seen in Europe/Istanbul. */
export function istDate(d: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
}

/** Add days to a YYYY-MM-DD string. */
export function addDays(date: string, n: number): string {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** Day of week (0 = Monday) of a YYYY-MM-DD string. */
export function weekday(date: string): number {
  return (new Date(`${date}T12:00:00Z`).getUTCDay() + 6) % 7;
}

/** The coming weekend (this week's Saturday/Sunday; today if it is the weekend). */
export function comingWeekend(): { sat: string; sun: string } {
  const t = istDate();
  const dow = weekday(t);
  const sat = dow === 6 ? addDays(t, -1) : addDays(t, 5 - dow);
  return { sat, sun: addDays(sat, 1) };
}

export async function login(page: Page, user: { email: string; password: string }) {
  await page.goto('/login');
  await page.getByLabel('E-posta').fill(user.email);
  await page.getByLabel('Şifre').fill(user.password);
  await page.getByRole('button', { name: /Giriş/ }).click();
  await expect(page).toHaveURL(/\/$/);
}

/** New isolated browser context logged in as `user`. */
export async function loggedInPage(browser: Browser, user: { email: string; password: string }) {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await login(page, user);
  return page;
}

export async function setScope(page: Page, label: 'Benim' | 'Eşim' | 'Ortak') {
  await page.locator('header').getByRole('tab', { name: label, exact: true }).click();
  await expect(page.locator('header').getByRole('tab', { name: label, exact: true })).toHaveAttribute('aria-selected', 'true');
}

/** Calls the API with the logged-in user's token. */
export async function api<T = unknown>(page: Page, method: string, path: string, body?: unknown): Promise<T> {
  return page.evaluate(
    async ({ method, path, body }) => {
      const token = localStorage.getItem('ortakplan.token');
      const res = await fetch(`/api${path}`, {
        method,
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      if (!res.ok) throw new Error(`${method} ${path} → ${res.status} ${await res.text()}`);
      return res.json();
    },
    { method, path, body },
  ) as Promise<T>;
}

/** Opens the calendar in month view on the month containing `date`. */
export async function openMonth(page: Page, date: string) {
  await page.goto('/calendar');
  await page.getByRole('tab', { name: 'Ay', exact: true }).click();
  const target = date.slice(0, 7);
  // The 16th cell of the grid always belongs to the displayed month.
  const mid = page.locator('[data-date]').nth(15);
  for (let i = 0; i < 24; i++) {
    const shown = (await mid.getAttribute('data-date'))!;
    if (shown.slice(0, 7) === target) break;
    await page.getByRole('button', { name: shown.slice(0, 7) < target ? 'Sonraki' : 'Önceki' }).click();
    await expect(mid).not.toHaveAttribute('data-date', shown);
  }
  const cell = monthCell(page, date);
  await expect(cell).toBeVisible();
  return cell;
}

export function monthCell(page: Page, date: string): Locator {
  return page.locator(`[data-date="${date}"]`);
}

/** A chip (event / task / goal / plan) by its title, inside a container. */
export function chip(container: Locator, title: string | RegExp): Locator {
  return container.locator('button, a').filter({ hasText: title });
}

/** Creates an all-day event by clicking the day cell in month view. */
export async function addAllDayEvent(page: Page, date: string, title: string, opts: { private?: boolean } = {}) {
  const cell = await openMonth(page, date);
  await cell.click({ position: { x: 30, y: 10 } });
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByText('Yeni etkinlik')).toBeVisible();
  await dialog.getByLabel('Başlık').fill(title);
  if (opts.private) await dialog.getByRole('tab', { name: /Özel/ }).click();
  await dialog.getByRole('button', { name: 'Kaydet' }).click();
  await expect(dialog).toBeHidden();
  await expect(chip(cell, title)).toBeVisible();
}

/** Drag with real pointer events (dnd-kit's PointerSensor needs intermediate moves). */
export async function dragTo(page: Page, source: Locator, target: Locator) {
  await source.scrollIntoViewIfNeeded();
  await page.waitForTimeout(400); // let a previous drop animation finish
  const s = await source.boundingBox();
  const t = await target.boundingBox();
  if (!s || !t) throw new Error('drag: element not visible');
  await page.mouse.move(s.x + s.width / 2, s.y + s.height / 2);
  await page.mouse.down();
  await page.mouse.move(s.x + s.width / 2 + 10, s.y + s.height / 2 + 10, { steps: 5 });
  await page.mouse.move(t.x + t.width / 2, t.y + Math.min(t.height / 2, 80), { steps: 20 });
  await page.waitForTimeout(150);
  await page.mouse.up();
}
