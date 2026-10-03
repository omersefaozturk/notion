import { test } from 'node:test';
import assert from 'node:assert/strict';
import { toPositional, schemaTables, ensureSchema, createDb } from '../src/db.js';
import { setup } from './helpers.js';

test('toPositional rewrites ? outside quotes only', () => {
  assert.equal(
    toPositional(`SELECT '?', "a?" FROM t WHERE a = ? AND b IN (?, ?) AND c = 'it''s ?'`),
    `SELECT '?', "a?" FROM t WHERE a = $1 AND b IN ($2, $3) AND c = 'it''s ?'`,
  );
});

test('schema lists every table and ensureSchema is a no-op once applied', async () => {
  assert.deepEqual(schemaTables().sort(), ['events', 'goals', 'households', 'pages', 'tasks', 'users']);
  const { db } = await setup();
  assert.equal(await ensureSchema(db), false);
  const rls = await db.many(
    `SELECT relname FROM pg_class WHERE relrowsecurity AND relname IN (${schemaTables().map(() => '?').join(', ')})`,
    schemaTables(),
  );
  assert.equal(rls.length, schemaTables().length, 'RLS enabled on every table (blocks Supabase Data API)');
});

test('tx commits on success and rolls back on error; jsonb and booleans round-trip', async () => {
  const { db } = await setup();
  await db.tx(async (t) => {
    await t.query("INSERT INTO households (name, invite_code, created_at) VALUES (?, ?, '')", ['A', 'AAA']);
  });
  await assert.rejects(
    db.tx(async (t) => {
      await t.query("INSERT INTO households (name, invite_code, created_at) VALUES (?, ?, '')", ['B', 'BBB']);
      throw new Error('boom');
    }),
    /boom/,
  );
  assert.deepEqual((await db.many('SELECT name FROM households ORDER BY id')).map((r) => r.name), ['A']);

  const { id: hid } = await db.one('SELECT id FROM households');
  const { id: uid } = await db.one(
    "INSERT INTO users (household_id, name, email, password_hash, initial, color, created_at) VALUES (?, 'U', 'u@u.com', 'x', 'U', '#000000', '') RETURNING id",
    [hid],
  );
  const content = [{ id: 'b1', type: 'todo', text: "it's \"quoted\" ?", checked: true, children: [] }];
  const page = await db.one(
    "INSERT INTO pages (household_id, owner_id, content, created_at, updated_at) VALUES (?, ?, ?, '', '') RETURNING content",
    [hid, uid, content],
  );
  assert.deepEqual(page.content, content);
  const ev = await db.one(
    `INSERT INTO events (household_id, owner_id, title, start, "end", all_day, created_at, updated_at)
     VALUES (?, ?, 'e', '2026-10-10', '2026-10-10', ?, '', '') RETURNING all_day`,
    [hid, uid, true],
  );
  assert.equal(ev.all_day, true);
});

test('a duplicate e-mail with different case is rejected by the unique index', async () => {
  const { db } = await setup();
  const { id: hid } = await db.one("INSERT INTO households (name, invite_code, created_at) VALUES ('A', 'AAA', '') RETURNING id");
  const ins = (email) =>
    db.query(
      "INSERT INTO users (household_id, name, email, password_hash, initial, color, created_at) VALUES (?, 'U', ?, 'x', 'U', '#000000', '')",
      [hid, email],
    );
  await ins('a@a.com');
  await assert.rejects(ins('A@A.com'), (err) => err.code === '23505');
});

test('createDb picks the driver from the URL', () => {
  assert.equal(createDb({ url: 'postgresql://u:p@aws-0-eu-central-1.pooler.supabase.com:6543/postgres' }).kind, 'postgres');
  assert.equal(createDb({ url: '', memory: true }).kind, 'pglite');
});
