import { after } from 'node:test';
import request from 'supertest';
import { createDb } from '../src/db.js';
import { createApp } from '../src/app.js';

// One in-memory PGlite (real Postgres in WASM) per test file; node:test runs the
// tests of a file sequentially, so each setup() simply wipes the tables.
let shared;
after(() => shared?.close());

export async function setup() {
  // Set TEST_DATABASE_URL to run the suite against a real Postgres server instead
  // (use `node --test --test-concurrency=1`, the files share that database).
  shared ??= createDb({ memory: true, url: process.env.TEST_DATABASE_URL || '' });
  await shared.exec('TRUNCATE pages, goals, tasks, events, users, households RESTART IDENTITY CASCADE');
  const db = shared;
  const app = createApp({ db });
  return { db, app, api: request(app) };
}

/** Registers a user; returns { token, user, auth } where auth is the header value. */
export async function register(api, body) {
  const res = await api.post('/api/auth/register').send({ password: '123456', ...body });
  if (res.status !== 201) throw new Error(`register failed: ${res.status} ${JSON.stringify(res.body)}`);
  return { ...res.body, auth: `Bearer ${res.body.token}` };
}

/** Creates a household with two members (Ömer + partner). */
export async function couple(api) {
  const omer = await register(api, { name: 'Ömer', email: 'omer@test.com' });
  const me = await api.get('/api/auth/me').set('Authorization', omer.auth);
  const es = await register(api, { name: 'Eşim', email: 'es@test.com', inviteCode: me.body.household.inviteCode });
  return { omer, es, inviteCode: me.body.household.inviteCode };
}
