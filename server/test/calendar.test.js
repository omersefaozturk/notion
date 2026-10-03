import { test } from 'node:test';
import assert from 'node:assert/strict';
import { setup, couple } from './helpers.js';

async function populate(api, omer, es) {
  const post = (who, path, body) => api.post(path).set('Authorization', who.auth).send(body);
  await post(omer, '/api/events', { title: 'Ö etkinlik', start: '2026-10-10T09:00:00.000Z', end: '2026-10-10T10:00:00.000Z' });
  await post(es, '/api/events', { title: 'E etkinlik', start: '2026-10-11', allDay: true });
  await post(es, '/api/events', { title: 'E özel', start: '2026-10-11', allDay: true, visibility: 'private' });
  await post(omer, '/api/events', { title: 'Kasım', start: '2026-11-11T09:00:00.000Z' });
  await post(omer, '/api/tasks', { title: 'Görev ekim', dueDate: '2026-10-10' });
  await post(es, '/api/tasks', { title: 'Görev kasım', dueDate: '2026-11-02' });
  await post(es, '/api/tasks', { title: 'Tarihsiz' });
  await post(omer, '/api/goals', { title: 'Hafta hedef', period: 'weekly', periodStart: '2026-09-30' }); // 09-28..10-04
  await post(es, '/api/goals', { title: 'Ay hedef', period: 'monthly', periodStart: '2026-10-01' });
  await post(es, '/api/goals', { title: 'Eylül hedef', period: 'monthly', periodStart: '2026-09-01' });
  await post(omer, '/api/pages', { title: 'Ekim planı', period: 'monthly', periodStart: '2026-10-01' });
  await post(omer, '/api/pages', { title: 'Sıradan sayfa' });
}

test('calendar aggregates events, tasks, goals and plans in range', async () => {
  const { api } = setup();
  const { omer, es } = await couple(api);
  await populate(api, omer, es);

  const res = await api.get('/api/calendar?from=2026-10-01&to=2026-10-31').set('Authorization', omer.auth);
  assert.equal(res.status, 200);
  assert.deepEqual(Object.keys(res.body).sort(), ['events', 'goals', 'plans', 'tasks']);
  assert.deepEqual(res.body.events.map((e) => e.title), ['Ö etkinlik', 'E etkinlik']);
  assert.deepEqual(res.body.tasks.map((t) => t.title), ['Görev ekim']);
  assert.deepEqual(res.body.goals.map((g) => g.title).sort(), ['Ay hedef', 'Hafta hedef']);
  assert.deepEqual(res.body.plans.map((p) => p.title), ['Ekim planı']);
  assert.ok(res.body.events.every((e) => e.owner && e.owner.initial));

  const partner = await api.get('/api/calendar?from=2026-10-01&to=2026-10-31&scope=partner').set('Authorization', omer.auth);
  assert.deepEqual(partner.body.events.map((e) => e.title), ['E etkinlik']);
  assert.deepEqual(partner.body.tasks, []);
  assert.deepEqual(partner.body.goals.map((g) => g.title), ['Ay hedef']);
  assert.deepEqual(partner.body.plans, []);

  const esMine = await api.get('/api/calendar?from=2026-10-11&to=2026-10-11&scope=mine').set('Authorization', es.auth);
  assert.deepEqual(esMine.body.events.map((e) => e.title).sort(), ['E etkinlik', 'E özel']);
});

test('dashboard groups today / week / month and counts tasks', async () => {
  const { api } = setup();
  const { omer, es } = await couple(api);
  await populate(api, omer, es);
  const post = (who, path, body) => api.post(path).set('Authorization', who.auth).send(body);
  await post(omer, '/api/goals', { title: 'Günlük', period: 'daily', periodStart: '2026-10-10' });
  await post(omer, '/api/pages', { title: 'Günlük plan', period: 'daily', periodStart: '2026-10-10' });
  await post(omer, '/api/tasks', { title: 'Gecikmiş', dueDate: '2026-10-01' });
  await post(omer, '/api/tasks', { title: 'Bitti', dueDate: '2026-10-01', status: 'done' });

  const res = await api.get('/api/dashboard?date=2026-10-10').set('Authorization', omer.auth);
  assert.equal(res.status, 200);
  const b = res.body;
  assert.equal(b.date, '2026-10-10');
  assert.deepEqual(b.today.events.map((e) => e.title), ['Ö etkinlik']);
  assert.deepEqual(b.today.tasks.map((t) => t.title).sort(), ['Gecikmiş', 'Görev ekim']);
  assert.deepEqual(b.today.goals.map((g) => g.title), ['Günlük']);
  assert.deepEqual(b.today.plans.map((p) => p.title), ['Günlük plan']);
  assert.deepEqual(b.week.goals, []);
  assert.deepEqual(b.week.tasks.map((t) => t.title), ['Görev ekim']); // week 10-05..10-11
  assert.deepEqual(b.month.goals.map((g) => g.title), ['Ay hedef']);
  assert.deepEqual(b.month.plans.map((p) => p.title), ['Ekim planı']);
  assert.deepEqual(b.taskCounts, { todo: 4, doing: 0, done: 1 });

  const mine = await api.get('/api/dashboard?date=2026-10-10&scope=mine').set('Authorization', omer.auth);
  assert.deepEqual(mine.body.taskCounts, { todo: 2, doing: 0, done: 1 });
  const noDate = await api.get('/api/dashboard').set('Authorization', omer.auth);
  assert.equal(noDate.status, 200);
  assert.match(noDate.body.date, /^\d{4}-\d{2}-\d{2}$/);
});

test('seed populates both users with current data', async () => {
  const { db, api } = setup();
  const { seed } = await import('../src/seed.js');
  seed(db);
  seed(db); // idempotent
  const login = await api.post('/api/auth/login').send({ email: 'omer@example.com', password: '123456' });
  assert.equal(login.status, 200);
  assert.equal(login.body.user.initial, 'Ö');
  const auth = `Bearer ${login.body.token}`;
  const me = await api.get('/api/auth/me').set('Authorization', auth);
  assert.equal(me.body.household.name, 'Bizim Ev');
  assert.equal(me.body.household.members.length, 2);
  const dash = await api.get('/api/dashboard').set('Authorization', auth);
  assert.ok(dash.body.today.events.length > 0);
  assert.ok(dash.body.taskCounts.todo > 0 && dash.body.taskCounts.doing > 0 && dash.body.taskCounts.done > 0);
  const cal = await api.get('/api/calendar').set('Authorization', auth);
  const owners = new Set(cal.body.events.map((e) => e.owner.name));
  assert.deepEqual([...owners].sort(), ['Eşim', 'Ömer']);
});
