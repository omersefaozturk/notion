import { test } from 'node:test';
import assert from 'node:assert/strict';
import { setup, couple, register } from './helpers.js';

async function fixture() {
  const ctx = setup();
  const { api } = ctx;
  const { omer, es } = await couple(api);
  const mk = (who, body) => api.post('/api/events').set('Authorization', who.auth).send(body);
  const omerShared = (await mk(omer, { title: 'Ö ortak', start: '2026-10-10T10:00:00.000Z' })).body;
  const omerPrivate = (await mk(omer, { title: 'Ö özel', start: '2026-10-11T10:00:00.000Z', visibility: 'private' })).body;
  const esShared = (await mk(es, { title: 'E ortak', start: '2026-10-12T10:00:00.000Z' })).body;
  const esPrivate = (await mk(es, { title: 'E özel', start: '2026-10-13T10:00:00.000Z', visibility: 'private' })).body;
  return { ...ctx, omer, es, omerShared, omerPrivate, esShared, esPrivate };
}

const titles = (res) => res.body.map((e) => e.title).sort();

test('event shape includes owner summary and defaults', async () => {
  const { omerShared, omer } = await fixture();
  assert.equal(omerShared.visibility, 'shared');
  assert.equal(omerShared.end, omerShared.start);
  assert.equal(omerShared.allDay, false);
  assert.equal(omerShared.color, null);
  assert.deepEqual(omerShared.owner, {
    id: omer.user.id, name: 'Ömer', initial: 'Ö', color: omer.user.color,
  });
  for (const k of ['id', 'title', 'description', 'start', 'end', 'allDay', 'location', 'color', 'visibility', 'owner', 'createdAt', 'updatedAt']) {
    assert.ok(k in omerShared, k);
  }
});

test('scope mine / partner / merged', async () => {
  const { api, omer } = await fixture();
  const get = (scope) => api.get(`/api/events${scope ? `?scope=${scope}` : ''}`).set('Authorization', omer.auth);
  assert.deepEqual(titles(await get('mine')), ['Ö ortak', 'Ö özel']);
  assert.deepEqual(titles(await get('partner')), ['E ortak']);
  assert.deepEqual(titles(await get('merged')), ['E ortak', 'Ö ortak', 'Ö özel']);
  assert.deepEqual(titles(await get()), ['E ortak', 'Ö ortak', 'Ö özel']);
  const bad = await get('everyone');
  assert.equal(bad.status, 400);
});

test('private items are hidden from partner (404) and other households see nothing', async () => {
  const { api, omer, es, omerPrivate, omerShared } = await fixture();
  const r1 = await api.get(`/api/events/${omerPrivate.id}`).set('Authorization', es.auth);
  assert.equal(r1.status, 404);
  const r2 = await api.patch(`/api/events/${omerPrivate.id}`).set('Authorization', es.auth).send({ title: 'x' });
  assert.equal(r2.status, 404);
  const r3 = await api.get(`/api/events/${omerShared.id}`).set('Authorization', es.auth);
  assert.equal(r3.status, 200);

  const stranger = await register(api, { name: 'Yabancı', email: 'y@y.com' });
  const list = await api.get('/api/events').set('Authorization', stranger.auth);
  assert.deepEqual(list.body, []);
  const r4 = await api.get(`/api/events/${omerShared.id}`).set('Authorization', stranger.auth);
  assert.equal(r4.status, 404);
  assert.ok(omer);
});

test('only the owner may edit or delete an event', async () => {
  const { api, omer, es, omerShared } = await fixture();
  const r1 = await api.patch(`/api/events/${omerShared.id}`).set('Authorization', es.auth).send({ title: 'x' });
  assert.equal(r1.status, 403);
  assert.ok(r1.body.error);
  const r2 = await api.delete(`/api/events/${omerShared.id}`).set('Authorization', es.auth);
  assert.equal(r2.status, 403);
  const r3 = await api.patch(`/api/events/${omerShared.id}`).set('Authorization', omer.auth)
    .send({ title: 'Yeni', visibility: 'private', allDay: true, color: '#ff0000' });
  assert.equal(r3.status, 200);
  assert.equal(r3.body.title, 'Yeni');
  assert.equal(r3.body.visibility, 'private');
  assert.equal(r3.body.allDay, true);
  const r4 = await api.get(`/api/events/${omerShared.id}`).set('Authorization', es.auth);
  assert.equal(r4.status, 404);
  const r5 = await api.delete(`/api/events/${omerShared.id}`).set('Authorization', omer.auth);
  assert.equal(r5.status, 200);
  const r6 = await api.get(`/api/events/${omerShared.id}`).set('Authorization', omer.auth);
  assert.equal(r6.status, 404);
});

test('events range filter returns overlapping events', async () => {
  const { api, omer } = await fixture();
  await api.post('/api/events').set('Authorization', omer.auth)
    .send({ title: 'Uzun', start: '2026-10-01', end: '2026-10-20', allDay: true });
  const res = await api.get('/api/events?from=2026-10-11&to=2026-10-12').set('Authorization', omer.auth);
  assert.deepEqual(titles(res), ['E ortak', 'Uzun', 'Ö özel']);
  const res2 = await api.get('/api/events?from=2026-10-12T00:00:00.000Z&to=2026-10-12T23:59:59.999Z').set('Authorization', omer.auth);
  assert.deepEqual(titles(res2), ['E ortak', 'Uzun']);
  const bad = await api.post('/api/events').set('Authorization', omer.auth)
    .send({ title: 'Ters', start: '2026-10-10T10:00:00Z', end: '2026-10-10T09:00:00Z' });
  assert.equal(bad.status, 400);
  const missing = await api.post('/api/events').set('Authorization', omer.auth).send({ start: '2026-10-10' });
  assert.equal(missing.status, 400);
  assert.equal(missing.body.error, 'Başlık zorunludur');
});
