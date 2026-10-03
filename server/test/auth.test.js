import { test } from 'node:test';
import assert from 'node:assert/strict';
import { setup, register, couple } from './helpers.js';

test('health', async () => {
  const { api } = await setup();
  const res = await api.get('/api/health');
  assert.equal(res.status, 200);
  assert.deepEqual(res.body, { ok: true });
});

test('register creates a household, login and me work', async () => {
  const { api } = await setup();
  const reg = await register(api, { name: 'ömer', email: 'Omer@Test.com' });
  assert.ok(reg.token);
  assert.equal(reg.user.initial, 'Ö');
  assert.equal(reg.user.email, 'omer@test.com');
  assert.match(reg.user.color, /^#[0-9a-f]{6}$/i);
  assert.ok(reg.user.householdId);
  assert.equal(reg.user.password_hash, undefined);

  const login = await api.post('/api/auth/login').send({ email: 'omer@test.com', password: '123456' });
  assert.equal(login.status, 200);
  assert.equal(login.body.user.id, reg.user.id);

  const bad = await api.post('/api/auth/login').send({ email: 'omer@test.com', password: 'nope' });
  assert.equal(bad.status, 401);
  assert.equal(typeof bad.body.error, 'string');

  const me = await api.get('/api/auth/me').set('Authorization', `Bearer ${login.body.token}`);
  assert.equal(me.status, 200);
  assert.equal(me.body.household.name, 'ömer ailesi');
  assert.equal(me.body.household.members.length, 1);
  assert.ok(me.body.household.inviteCode);
});

test('unauthenticated requests get 401 with Turkish error', async () => {
  const { api } = await setup();
  const res = await api.get('/api/tasks');
  assert.equal(res.status, 401);
  assert.ok(res.body.error);
  const res2 = await api.get('/api/tasks').set('Authorization', 'Bearer garbage');
  assert.equal(res2.status, 401);
});

test('validation errors are 400 with Turkish message', async () => {
  const { api } = await setup();
  const res = await api.post('/api/auth/register').send({ name: 'A', email: 'bad', password: '123456' });
  assert.equal(res.status, 400);
  assert.equal(res.body.error, 'Geçerli bir e-posta adresi girin');
  const res2 = await api.post('/api/auth/register').send({ name: 'A', email: 'a@a.com', password: '1' });
  assert.equal(res2.status, 400);
  assert.match(res2.body.error, /Şifre/);
  const dup = await register(api, { name: 'A', email: 'a@a.com' });
  assert.ok(dup);
  const res3 = await api.post('/api/auth/register').send({ name: 'B', email: 'a@a.com', password: '123456' });
  assert.equal(res3.status, 409);
});

test('join household via invite code; invalid code rejected; members get distinct colors', async () => {
  const { api } = await setup();
  const { omer, es, inviteCode } = await couple(api);
  assert.equal(es.user.householdId, omer.user.householdId);
  assert.notEqual(es.user.color, omer.user.color);

  const hh = await api.get('/api/household').set('Authorization', es.auth);
  assert.equal(hh.status, 200);
  assert.equal(hh.body.inviteCode, inviteCode);
  assert.deepEqual(hh.body.members.map((m) => m.name), ['Ömer', 'Eşim']);
  assert.deepEqual(Object.keys(hh.body.members[0]).sort(), ['color', 'id', 'initial', 'name']);

  const bad = await api.post('/api/auth/register').send({ name: 'X', email: 'x@x.com', password: '123456', inviteCode: 'NOPE' });
  assert.equal(bad.status, 400);
  assert.equal(bad.body.error, 'Davet kodu geçersiz');

  const regen = await api.post('/api/household/invite-code').set('Authorization', omer.auth);
  assert.notEqual(regen.body.inviteCode, inviteCode);
  const renamed = await api.patch('/api/household').set('Authorization', omer.auth).send({ name: 'Bizim Ev' });
  assert.equal(renamed.body.name, 'Bizim Ev');
});

test('PATCH /auth/me updates profile and password', async () => {
  const { api } = await setup();
  const u = await register(api, { name: 'Ömer', email: 'o@o.com' });
  const res = await api.patch('/api/auth/me').set('Authorization', u.auth)
    .send({ name: 'Ömer S', initial: 'ş', color: '#123456', password: 'yenisifre' });
  assert.equal(res.status, 200);
  assert.equal(res.body.user.initial, 'Ş');
  assert.equal(res.body.user.color, '#123456');
  const login = await api.post('/api/auth/login').send({ email: 'o@o.com', password: 'yenisifre' });
  assert.equal(login.status, 200);
});
