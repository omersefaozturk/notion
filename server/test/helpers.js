import request from 'supertest';
import { openDb } from '../src/db.js';
import { createApp } from '../src/app.js';

export function setup() {
  const db = openDb(':memory:');
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
