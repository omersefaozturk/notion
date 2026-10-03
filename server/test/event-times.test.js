import { test } from 'node:test';
import assert from 'node:assert/strict';
import { setup, couple } from './helpers.js';
import { zonedToUtc, dateInTz, today } from '../src/lib/dates.js';
import { migrateEventTimes } from '../src/services/events.js';

test('zonedToUtc / dateInTz handle offsets and DST', () => {
  assert.equal(zonedToUtc('2026-10-03', 9, 0, 'Europe/Istanbul').toISOString(), '2026-10-03T06:00:00.000Z');
  assert.equal(zonedToUtc('2026-07-01', 0, 0, 'America/New_York').toISOString(), '2026-07-01T04:00:00.000Z');
  assert.equal(zonedToUtc('2026-12-01', 0, 0, 'America/New_York').toISOString(), '2026-12-01T05:00:00.000Z');
  assert.equal(dateInTz('2026-10-09T21:30:00.000Z', 'Europe/Istanbul'), '2026-10-10');
  assert.equal(dateInTz('2026-10-09T21:30:00.000Z', 'UTC'), '2026-10-09');
  assert.match(today('Pacific/Auckland'), /^\d{4}-\d{2}-\d{2}$/);
});

test('event times are normalised on write', async () => {
  const { api } = await setup();
  const { omer } = await couple(api);
  const post = (body) => api.post('/api/events').set('Authorization', omer.auth).send(body);

  const offset = await post({ title: 'Ofsetli', start: '2026-10-10T09:00:00+03:00', end: '2026-10-10T10:00+03:00' });
  assert.equal(offset.status, 201);
  assert.equal(offset.body.start, '2026-10-10T06:00:00.000Z');
  assert.equal(offset.body.end, '2026-10-10T07:00:00.000Z');

  const local = await post({ title: 'Yerel', start: '2026-10-10T09:00', tz: 'Europe/Istanbul' });
  assert.equal(local.body.start, '2026-10-10T06:00:00.000Z');
  assert.equal(local.body.end, local.body.start);

  const allDayIso = await post({ title: 'Tüm gün', start: '2026-10-10T21:30:00.000Z', end: '2026-10-11T21:30:00.000Z', allDay: true });
  // interpreted in the household time zone (Europe/Istanbul) → 11th and 12th
  assert.equal(allDayIso.body.start, '2026-10-11');
  assert.equal(allDayIso.body.end, '2026-10-12');

  const bad = await post({ title: 'Ters', start: '2026-10-10', end: '2026-10-09', allDay: true });
  assert.equal(bad.status, 400);
  const badTz = await api.get('/api/calendar?from=2026-10-01&to=2026-10-31&tz=Mars/Base').set('Authorization', omer.auth);
  assert.equal(badTz.status, 400);

  // toggling all-day converts the stored format
  const toAllDay = await api.patch(`/api/events/${offset.body.id}`).set('Authorization', omer.auth).send({ allDay: true });
  assert.equal(toAllDay.body.start, '2026-10-10');
  assert.equal(toAllDay.body.end, '2026-10-10');
  const toTimed = await api
    .patch(`/api/events/${offset.body.id}`)
    .set('Authorization', omer.auth)
    .send({ allDay: false, start: '2026-10-10T18:00:00.000Z', end: '2026-10-10T19:00:00.000Z' });
  assert.equal(toTimed.body.start, '2026-10-10T18:00:00.000Z');
  assert.equal(toTimed.body.allDay, false);
});

async function titlesOn(api, who, date, tz) {
  const res = await api.get(`/api/calendar?from=${date}&to=${date}&tz=${encodeURIComponent(tz)}`).set('Authorization', who.auth);
  assert.equal(res.status, 200);
  return res.body.events.map((e) => e.title).sort();
}

test('all-day events show on their date in every time zone', async () => {
  const { api } = await setup();
  const { omer, es } = await couple(api);
  await api.post('/api/events').set('Authorization', es.auth).send({ title: 'Piknik', start: '2026-10-11', allDay: true });
  for (const tz of ['Europe/Istanbul', 'UTC', 'America/Los_Angeles', 'Pacific/Auckland']) {
    assert.deepEqual(await titlesOn(api, omer, '2026-10-11', tz), ['Piknik'], tz);
    assert.deepEqual(await titlesOn(api, omer, '2026-10-10', tz), [], tz);
    assert.deepEqual(await titlesOn(api, omer, '2026-10-12', tz), [], tz);
  }
});

test('timed events are matched by instant in the requested time zone, on every day they span', async () => {
  const { api } = await setup();
  const { omer } = await couple(api);
  const post = (body) => api.post('/api/events').set('Authorization', omer.auth).send(body);
  // 00:30–01:30 on the 10th in Istanbul == 21:30–22:30 on the 9th in UTC
  await post({ title: 'Gece yarısı', start: '2026-10-09T21:30:00.000Z', end: '2026-10-09T22:30:00.000Z' });
  // Fri 20:00 → Sun 10:00 Istanbul
  await post({ title: 'Kamp', start: '2026-10-09T17:00:00.000Z', end: '2026-10-11T07:00:00.000Z' });
  // 22:00 → 00:00 (ends exactly at midnight Istanbul)
  await post({ title: 'Geç yemek', start: '2026-10-12T19:00:00.000Z', end: '2026-10-12T21:00:00.000Z' });
  // instantaneous event at midnight Istanbul
  await post({ title: 'Anlık', start: '2026-10-14T21:00:00.000Z' });

  assert.deepEqual(await titlesOn(api, omer, '2026-10-09', 'Europe/Istanbul'), ['Kamp']);
  assert.deepEqual(await titlesOn(api, omer, '2026-10-10', 'Europe/Istanbul'), ['Gece yarısı', 'Kamp']);
  assert.deepEqual(await titlesOn(api, omer, '2026-10-11', 'Europe/Istanbul'), ['Kamp']);
  assert.deepEqual(await titlesOn(api, omer, '2026-10-12', 'Europe/Istanbul'), ['Geç yemek']);
  assert.deepEqual(await titlesOn(api, omer, '2026-10-13', 'Europe/Istanbul'), []);
  assert.deepEqual(await titlesOn(api, omer, '2026-10-14', 'Europe/Istanbul'), []);
  assert.deepEqual(await titlesOn(api, omer, '2026-10-15', 'Europe/Istanbul'), ['Anlık']);

  assert.deepEqual(await titlesOn(api, omer, '2026-10-09', 'UTC'), ['Gece yarısı', 'Kamp']);
  assert.deepEqual(await titlesOn(api, omer, '2026-10-10', 'UTC'), ['Kamp']);

  // ISO bounds on /api/events
  const iso = await api
    .get('/api/events?from=2026-10-12T20:00:00.000Z&to=2026-10-12T23:00:00.000Z')
    .set('Authorization', omer.auth);
  assert.deepEqual(iso.body.map((e) => e.title), ['Geç yemek']);
});

test('dashboard today uses the requested time zone', async () => {
  const { api } = await setup();
  const { omer } = await couple(api);
  await api.post('/api/events').set('Authorization', omer.auth)
    .send({ title: 'Gece yarısı', start: '2026-10-09T21:30:00.000Z', end: '2026-10-09T22:30:00.000Z' });
  const ist = await api.get('/api/dashboard?date=2026-10-10&tz=Europe/Istanbul').set('Authorization', omer.auth);
  assert.deepEqual(ist.body.today.events.map((e) => e.title), ['Gece yarısı']);
  const utc = await api.get('/api/dashboard?date=2026-10-10&tz=UTC').set('Authorization', omer.auth);
  assert.deepEqual(utc.body.today.events, []);
});

test('legacy mixed-format rows are migrated', async () => {
  const { db, api } = await setup();
  const { omer } = await couple(api);
  const ins = (...params) =>
    db.query(
      `INSERT INTO events (household_id, owner_id, title, start, "end", all_day, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, '', '')`,
      params,
    );
  const hid = omer.user.householdId;
  await ins(hid, omer.user.id, 'Eski tüm gün', '2026-10-10T21:00:00.000Z', '2026-10-10T21:00:00.000Z', true);
  await ins(hid, omer.user.id, 'Eski saatli', '2026-10-10T09:00:00+03:00', '2026-10-10T10:00:00+03:00', false);
  assert.equal(await migrateEventTimes(db, 'Europe/Istanbul'), 2);
  const rows = await db.many('SELECT title, start, "end" FROM events ORDER BY id');
  assert.deepEqual(rows.map((r) => [r.title, r.start, r.end]), [
    ['Eski tüm gün', '2026-10-11', '2026-10-11'],
    ['Eski saatli', '2026-10-10T06:00:00.000Z', '2026-10-10T07:00:00.000Z'],
  ]);
});

test('seed times are sensible wall-clock times in Europe/Istanbul', async () => {
  const { db } = await setup();
  const { seed } = await import('../src/seed.js');
  await seed(db);
  const row = await db.one("SELECT start FROM events WHERE title = 'Yoga dersi'");
  const hhmm = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Istanbul', hour: '2-digit', minute: '2-digit' })
    .format(new Date(row.start));
  assert.equal(hhmm, '09:00');
  const allDay = await db.one(`SELECT start, "end" FROM events WHERE title = 'Piknik'`);
  assert.match(allDay.start, /^\d{4}-\d{2}-\d{2}$/);
});
