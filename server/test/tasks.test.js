import { test } from 'node:test';
import assert from 'node:assert/strict';
import { setup, couple } from './helpers.js';

test('tasks: create appends to column, list ordered by status then position', async () => {
  const { api } = await setup();
  const { omer, es } = await couple(api);
  const mk = (who, body) => api.post('/api/tasks').set('Authorization', who.auth).send(body);
  const a = (await mk(omer, { title: 'A' })).body;
  const b = (await mk(es, { title: 'B' })).body;
  const c = (await mk(omer, { title: 'C', status: 'done' })).body;
  const d = (await mk(omer, { title: 'D', status: 'doing', priority: 'high', dueDate: '2026-10-05', assigneeId: es.user.id })).body;
  assert.equal(a.status, 'todo');
  assert.equal(a.priority, 'medium');
  assert.equal(a.completedAt, null);
  assert.equal(a.assignee, null);
  assert.ok(b.position > a.position);
  assert.ok(c.completedAt);
  assert.equal(d.assignee.id, es.user.id);
  assert.equal(d.dueDate, '2026-10-05');

  const list = await api.get('/api/tasks').set('Authorization', omer.auth);
  assert.deepEqual(list.body.map((t) => t.title), ['A', 'B', 'D', 'C']);
  const doing = await api.get('/api/tasks?status=doing').set('Authorization', omer.auth);
  assert.deepEqual(doing.body.map((t) => t.title), ['D']);
  const due = await api.get('/api/tasks?dueFrom=2026-10-01&dueTo=2026-10-31').set('Authorization', omer.auth);
  assert.deepEqual(due.body.map((t) => t.title), ['D']);
  const mine = await api.get('/api/tasks?scope=partner').set('Authorization', omer.auth);
  assert.deepEqual(mine.body.map((t) => t.title), ['B']);

  const badAssignee = await mk(omer, { title: 'X', assigneeId: 9999 });
  assert.equal(badAssignee.status, 400);
});

test('tasks: move sets/clears completedAt and reorders', async () => {
  const { api } = await setup();
  const { omer } = await couple(api);
  const mk = (title) => api.post('/api/tasks').set('Authorization', omer.auth).send({ title });
  const a = (await mk('A')).body;
  const b = (await mk('B')).body;
  const c = (await mk('C')).body;

  // move C between A and B
  const moved = await api.post(`/api/tasks/${c.id}/move`).set('Authorization', omer.auth)
    .send({ status: 'todo', position: (a.position + b.position) / 2 });
  assert.equal(moved.status, 200);
  let list = await api.get('/api/tasks').set('Authorization', omer.auth);
  assert.deepEqual(list.body.map((t) => t.title), ['A', 'C', 'B']);

  const done = await api.post(`/api/tasks/${a.id}/move`).set('Authorization', omer.auth).send({ status: 'done', position: 0 });
  assert.equal(done.body.status, 'done');
  assert.ok(done.body.completedAt);
  const back = await api.post(`/api/tasks/${a.id}/move`).set('Authorization', omer.auth).send({ status: 'doing', position: 5 });
  assert.equal(back.body.completedAt, null);
  assert.equal(back.body.position, 5);

  const viaPatch = await api.patch(`/api/tasks/${b.id}`).set('Authorization', omer.auth).send({ status: 'done' });
  assert.ok(viaPatch.body.completedAt);
  list = await api.get('/api/tasks?status=done').set('Authorization', omer.auth);
  assert.deepEqual(list.body.map((t) => t.title), ['B']);
});

test('tasks: partner may move a shared task but not edit other fields; private is invisible', async () => {
  const { api } = await setup();
  const { omer, es } = await couple(api);
  const shared = (await api.post('/api/tasks').set('Authorization', omer.auth).send({ title: 'Ortak' })).body;
  const priv = (await api.post('/api/tasks').set('Authorization', omer.auth).send({ title: 'Özel', visibility: 'private' })).body;

  const mv = await api.post(`/api/tasks/${shared.id}/move`).set('Authorization', es.auth).send({ status: 'doing', position: 1 });
  assert.equal(mv.status, 200);
  assert.equal(mv.body.status, 'doing');

  const patchStatus = await api.patch(`/api/tasks/${shared.id}`).set('Authorization', es.auth).send({ status: 'done', position: 3 });
  assert.equal(patchStatus.status, 200);
  assert.ok(patchStatus.body.completedAt);

  // sending unchanged fields alongside status is allowed
  const sameFields = await api.patch(`/api/tasks/${shared.id}`).set('Authorization', es.auth)
    .send({ status: 'todo', title: 'Ortak' });
  assert.equal(sameFields.status, 200);

  const patchTitle = await api.patch(`/api/tasks/${shared.id}`).set('Authorization', es.auth).send({ title: 'Değişti' });
  assert.equal(patchTitle.status, 403);
  const del = await api.delete(`/api/tasks/${shared.id}`).set('Authorization', es.auth);
  assert.equal(del.status, 403);

  const mvPriv = await api.post(`/api/tasks/${priv.id}/move`).set('Authorization', es.auth).send({ status: 'doing', position: 1 });
  assert.equal(mvPriv.status, 404);
  const list = await api.get('/api/tasks').set('Authorization', es.auth);
  assert.deepEqual(list.body.map((t) => t.title), ['Ortak']);

  const ownerDel = await api.delete(`/api/tasks/${shared.id}`).set('Authorization', omer.auth);
  assert.equal(ownerDel.status, 200);
});
