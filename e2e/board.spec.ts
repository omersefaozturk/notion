import { expect, test } from '@playwright/test';
import { dragTo, ES, loggedInPage, login, OMER, uniq } from './helpers';

test('board: create a task and drag it todo → doing → done; partner can move a shared task', async ({ page, browser }) => {
  const id = uniq();
  const title = `Perde tak ${id}`;
  await login(page, OMER);
  await page.goto('/board');

  const col = (s: 'todo' | 'doing' | 'done') => page.getByTestId(`column-${s}`);
  const card = () => page.getByTestId('task-card').filter({ hasText: title });

  // quick add in "Yapılacak"
  await col('todo').getByRole('button', { name: '+ Yeni görev' }).click();
  const input = col('todo').getByPlaceholder('Görev başlığı…');
  await input.fill(title);
  await input.press('Enter');
  await expect(col('todo').getByTestId('task-card').filter({ hasText: title })).toBeVisible();
  await expect(card().getByLabel('Ömer')).toHaveText('Ö');
  await input.press('Escape');

  await dragTo(page, card(), col('doing'));
  await expect(col('doing').getByTestId('task-card').filter({ hasText: title })).toBeVisible();
  await page.waitForLoadState('networkidle');
  await dragTo(page, card(), col('done'));
  await expect(col('done').getByTestId('task-card').filter({ hasText: title })).toBeVisible();
  await page.waitForLoadState('networkidle');

  await page.reload();
  await expect(col('done').getByTestId('task-card').filter({ hasText: title })).toBeVisible();
  await expect(col('todo').getByTestId('task-card').filter({ hasText: title })).toHaveCount(0);

  // Eşim moves Ömer's shared task back to "Yapılıyor"
  const es = await loggedInPage(browser, ES);
  await es.goto('/board');
  const esCard = es.getByTestId('task-card').filter({ hasText: title });
  await expect(es.getByTestId('column-done').getByTestId('task-card').filter({ hasText: title })).toBeVisible();
  await dragTo(es, esCard, es.getByTestId('column-doing'));
  await expect(es.getByTestId('column-doing').getByTestId('task-card').filter({ hasText: title })).toBeVisible();
  await es.waitForLoadState('networkidle');
  await es.reload();
  await expect(es.getByTestId('column-doing').getByTestId('task-card').filter({ hasText: title })).toBeVisible();

  // Ömer sees the partner's move
  await page.reload();
  await expect(col('doing').getByTestId('task-card').filter({ hasText: title })).toBeVisible();
  await es.context().close();
});
