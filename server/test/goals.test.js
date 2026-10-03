import { test } from 'node:test';
import assert from 'node:assert/strict';
import { setup, couple } from './helpers.js';
import { normalizePeriodStart, periodEnd } from '../src/lib/dates.js';

test('date helpers: Monday week start and period ends', () => {
  assert.equal(normalizePeriodStart('weekly', '2026-10-03'), '2026-09-28'); // Saturday → Monday
  assert.equal(normalizePeriodStart('weekly', '2026-10-04'), '2026-09-28'); // Sunday → previous Monday
  assert.equal(normalizePeriodStart('weekly', '2026-09-28'), '2026-09-28');
  assert.equal(normalizePeriodStart('monthly', '2026-10-17'), '2026-10-01');
  assert.equal(normalizePeriodStart('daily', '2026-10-17'), '2026-10-17');
  assert.equal(periodEnd('weekly', '2026-12-30'), '2027-01-03');
  assert.equal(periodEnd('monthly', '2028-02-10'), '2028-02-29');
  assert.equal(periodEnd('daily', '2026-10-17'), '2026-10-17');
});

test('goals: period normalisation, periodEnd, filters', async () => {
  const { api } = setup();
  const { omer } = await couple(api);
  const mk = (body) => api.post('/api/goals').set('Authorization', omer.auth).send(body);
  const w = (await mk({ title: 'Haftalık', period: 'weekly', periodStart: '2026-10-03' })).body;
  assert.equal(w.periodStart, '2026-09-28');
  assert.equal(w.periodEnd, '2026-10-04');
  assert.equal(w.progress, 0);
  assert.equal(w.done, false);
  const m = (await mk({ title: 'Aylık', period: 'monthly', periodStart: '2026-10-17', progress: 30 })).body;
  assert.equal(m.periodStart, '2026-10-01');
  assert.equal(m.periodEnd, '2026-10-31');
  const d = (await mk({ title: 'Günlük', period: 'daily', periodStart: '2026-10-05' })).body;
  assert.equal(d.periodEnd, '2026-10-05');

  const bad = await mk({ title: 'X', period: 'yearly', periodStart: '2026-10-05' });
  assert.equal(bad.status, 400);
  const badDate = await mk({ title: 'X', period: 'daily', periodStart: '2026-13-05' });
  assert.equal(badDate.status, 400);

  const weekly = await api.get('/api/goals?period=weekly&from=2026-09-28&to=2026-09-28').set('Authorization', omer.auth);
  assert.deepEqual(weekly.body.map((g) => g.title), ['Haftalık']);
  const oct = await api.get('/api/goals?from=2026-10-01&to=2026-10-31').set('Authorization', omer.auth);
  assert.deepEqual(oct.body.map((g) => g.title).sort(), ['Aylık', 'Günlük']);

  const moved = await api.patch(`/api/goals/${w.id}`).set('Authorization', omer.auth).send({ period: 'monthly' });
  assert.equal(moved.body.periodStart, '2026-09-01');
  assert.equal(moved.body.periodEnd, '2026-09-30');
});

test('goals: partner may toggle done/progress on shared goals only', async () => {
  const { api } = setup();
  const { omer, es } = await couple(api);
  const g = (await api.post('/api/goals').set('Authorization', omer.auth)
    .send({ title: 'Ortak hedef', period: 'daily', periodStart: '2026-10-03' })).body;
  const p = (await api.post('/api/goals').set('Authorization', omer.auth)
    .send({ title: 'Özel', period: 'daily', periodStart: '2026-10-03', visibility: 'private' })).body;

  const prog = await api.patch(`/api/goals/${g.id}`).set('Authorization', es.auth).send({ progress: 60 });
  assert.equal(prog.status, 200);
  assert.equal(prog.body.progress, 60);
  assert.equal(prog.body.done, false);
  const done = await api.patch(`/api/goals/${g.id}`).set('Authorization', es.auth).send({ done: true });
  assert.equal(done.body.done, true);
  assert.equal(done.body.progress, 100);

  const title = await api.patch(`/api/goals/${g.id}`).set('Authorization', es.auth).send({ title: 'x' });
  assert.equal(title.status, 403);
  const del = await api.delete(`/api/goals/${g.id}`).set('Authorization', es.auth);
  assert.equal(del.status, 403);
  const priv = await api.patch(`/api/goals/${p.id}`).set('Authorization', es.auth).send({ done: true });
  assert.equal(priv.status, 404);
});
