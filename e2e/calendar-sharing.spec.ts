import { expect, test } from '@playwright/test';
import { addAllDayEvent, chip, comingWeekend, ES, loggedInPage, monthCell, OMER, openMonth, setScope, uniq } from './helpers';

test('each spouse plans the weekend; merged calendar shows both with letter badges', async ({ browser }) => {
  const { sat, sun } = comingWeekend();
  const id = uniq();
  const omerTitle = `Ömer hafta sonu ${id}`;
  const esTitle = `Eşim hafta sonu ${id}`;
  const esPrivate = `Eşim gizli ${id}`;

  // Ömer plans Saturday
  const omer = await loggedInPage(browser, OMER);
  await setScope(omer, 'Benim');
  await addAllDayEvent(omer, sat, omerTitle);

  // Eşim plans Sunday (+ a private event)
  const es = await loggedInPage(browser, ES);
  await setScope(es, 'Benim');
  await addAllDayEvent(es, sun, esTitle);
  await addAllDayEvent(es, sun, esPrivate, { private: true });
  // her own calendar shows both of hers, not Ömer's
  await expect(chip(monthCell(es, sun), esPrivate)).toContainText('E');
  await expect(chip(monthCell(es, sat), omerTitle)).toHaveCount(0);

  // Ömer — Ortak (merged): both weekend plans, each with its owner's letter
  await setScope(omer, 'Ortak');
  await openMonth(omer, sat);
  const omerChip = chip(monthCell(omer, sat), omerTitle);
  const esChip = chip(monthCell(omer, sun), esTitle);
  await expect(omerChip).toBeVisible();
  await expect(esChip).toBeVisible();
  await expect(omerChip.getByLabel('Ömer')).toHaveText('Ö');
  await expect(esChip.getByLabel('Eşim')).toHaveText('E');
  await expect(omer.getByTestId('member-legend')).toContainText('Ömer');
  await expect(omer.getByTestId('member-legend')).toContainText('Eşim');
  // the private event is never visible to Ömer
  await expect(omer.getByText(esPrivate)).toHaveCount(0);

  // Ömer — Benim: only his own
  await setScope(omer, 'Benim');
  await expect(chip(monthCell(omer, sat), omerTitle)).toBeVisible();
  await expect(chip(monthCell(omer, sun), esTitle)).toHaveCount(0);

  // Ömer — Eşim: only partner's shared items
  await setScope(omer, 'Eşim');
  await expect(chip(monthCell(omer, sun), esTitle)).toBeVisible();
  await expect(chip(monthCell(omer, sat), omerTitle)).toHaveCount(0);
  await expect(omer.getByText(esPrivate)).toHaveCount(0);
  // every item in partner scope carries Eşim's letter
  const badges = await omer.locator('[data-date] [aria-label]').evaluateAll((els) =>
    els.map((e) => e.getAttribute('aria-label')).filter((l) => l === 'Ömer' || l === 'Eşim'),
  );
  expect(badges.length).toBeGreaterThan(0);
  expect(new Set(badges)).toEqual(new Set(['Eşim']));

  // the private event stays hidden even via the API and in week/day views
  await setScope(omer, 'Ortak');
  await omer.getByRole('tab', { name: 'Hafta', exact: true }).click();
  await expect(omer.getByText(esTitle).first()).toBeVisible();
  await expect(omer.getByText(esPrivate)).toHaveCount(0);
  const res = await omer.evaluate(async (d) => {
    const token = localStorage.getItem('ortakplan.token');
    const r = await fetch(`/api/calendar?from=${d}&to=${d}&scope=merged`, { headers: { Authorization: `Bearer ${token}` } });
    return (await r.json()).events.map((e: { title: string }) => e.title);
  }, sun);
  expect(res).toContain(esTitle);
  expect(res).not.toContain(esPrivate);

  await omer.context().close();
  await es.context().close();
});
