import { test } from 'node:test';
import assert from 'node:assert/strict';
import { setup, couple } from './helpers.js';

test('pages: tree, hasChildren, breadcrumbs, content round-trip', async () => {
  const { api } = setup();
  const { omer, es } = await couple(api);
  const mk = (who, body) => api.post('/api/pages').set('Authorization', who.auth).send(body);
  const root = (await mk(omer, { title: 'Ev', icon: '🏠' })).body;
  assert.equal(root.parentId, null);
  assert.deepEqual(root.content, []);
  assert.deepEqual(root.breadcrumbs, []);
  assert.equal(root.hasChildren, false);

  const child = (await mk(es, { title: 'Market', parentId: root.id })).body;
  const content = [{ id: 'b1', type: 'todo', text: 'Süt', checked: true, children: [] }];
  const grand = (await mk(omer, { title: 'Detay', parentId: child.id, content })).body;
  assert.deepEqual(grand.content, content);
  assert.deepEqual(grand.breadcrumbs, [
    { id: root.id, title: 'Ev', icon: '🏠' },
    { id: child.id, title: 'Market', icon: '' },
  ]);

  const roots = await api.get('/api/pages?parentId=root').set('Authorization', omer.auth);
  assert.deepEqual(roots.body.map((p) => p.title), ['Ev']);
  assert.equal(roots.body[0].hasChildren, true);
  assert.equal('content' in roots.body[0], false);
  const kids = await api.get(`/api/pages?parentId=${root.id}`).set('Authorization', omer.auth);
  assert.deepEqual(kids.body.map((p) => p.title), ['Market']);
  assert.equal(kids.body[0].owner.id, es.user.id);

  // private child does not count for partner's hasChildren
  const lone = (await mk(omer, { title: 'Tek' })).body;
  await mk(omer, { title: 'Gizli', parentId: lone.id, visibility: 'private' });
  const esView = await api.get(`/api/pages/${lone.id}`).set('Authorization', es.auth);
  assert.equal(esView.body.hasChildren, false);
  const omerView = await api.get(`/api/pages/${lone.id}`).set('Authorization', omer.auth);
  assert.equal(omerView.body.hasChildren, true);

  const upd = await api.patch(`/api/pages/${grand.id}`).set('Authorization', omer.auth)
    .send({ content: [{ id: 'b2', type: 'heading1', text: 'Başlık' }], title: 'Detaylar' });
  assert.equal(upd.status, 200);
  assert.equal(upd.body.content[0].text, 'Başlık');
  const badContent = await api.patch(`/api/pages/${grand.id}`).set('Authorization', omer.auth).send({ content: 'x' });
  assert.equal(badContent.status, 400);

  const cycle = await api.patch(`/api/pages/${root.id}`).set('Authorization', omer.auth).send({ parentId: grand.id });
  assert.equal(cycle.status, 400);
  const notOwner = await api.patch(`/api/pages/${root.id}`).set('Authorization', es.auth).send({ title: 'x' });
  assert.equal(notOwner.status, 403);

  const moveToRoot = await api.patch(`/api/pages/${grand.id}`).set('Authorization', omer.auth).send({ parentId: null });
  assert.equal(moveToRoot.body.parentId, null);
  assert.deepEqual(moveToRoot.body.breadcrumbs, []);
});

test('pages: delete cascades to child pages', async () => {
  const { api } = setup();
  const { omer } = await couple(api);
  const mk = (body) => api.post('/api/pages').set('Authorization', omer.auth).send(body);
  const a = (await mk({ title: 'A' })).body;
  const b = (await mk({ title: 'B', parentId: a.id })).body;
  const c = (await mk({ title: 'C', parentId: b.id })).body;
  const other = (await mk({ title: 'Diğer' })).body;

  const del = await api.delete(`/api/pages/${a.id}`).set('Authorization', omer.auth);
  assert.equal(del.status, 200);
  for (const id of [a.id, b.id, c.id]) {
    const r = await api.get(`/api/pages/${id}`).set('Authorization', omer.auth);
    assert.equal(r.status, 404);
  }
  const all = await api.get('/api/pages').set('Authorization', omer.auth);
  assert.deepEqual(all.body.map((p) => p.id), [other.id]);
});

test('pages: plans with period normalisation and filters', async () => {
  const { api } = setup();
  const { omer, es } = await couple(api);
  const mk = (who, body) => api.post('/api/pages').set('Authorization', who.auth).send(body);
  const wk = (await mk(omer, { title: 'Hafta', period: 'weekly', periodStart: '2026-10-01' })).body;
  assert.equal(wk.periodStart, '2026-09-28');
  await mk(es, { title: 'Ay', period: 'monthly', periodStart: '2026-10-15', visibility: 'private' });
  await mk(es, { title: 'Gün', period: 'daily', periodStart: '2026-10-03' });
  await mk(omer, { title: 'Normal sayfa' });

  const weekly = await api.get('/api/pages?period=weekly').set('Authorization', omer.auth);
  assert.deepEqual(weekly.body.map((p) => p.title), ['Hafta']);
  const ranged = await api.get('/api/pages?from=2026-10-01&to=2026-10-31').set('Authorization', omer.auth);
  assert.deepEqual(ranged.body.map((p) => p.title), ['Gün']); // Ay is private to Eşim
  const esRanged = await api.get('/api/pages?from=2026-10-01&to=2026-10-31&scope=mine').set('Authorization', es.auth);
  assert.deepEqual(esRanged.body.map((p) => p.title), ['Ay', 'Gün']);

  const noPeriod = await mk(omer, { title: 'X', periodStart: '2026-10-01' });
  assert.equal(noPeriod.status, 400);
});

test('page content keeps toggle collapsed state and nested list children', async () => {
  const { api } = setup();
  const { omer } = await couple(api);
  const content = [
    { id: 'a', type: 'toggle', text: 'Aç/kapa', collapsed: false, children: [{ id: 'b', type: 'paragraph', text: 'iç' }] },
    { id: 'c', type: 'bullet', text: 'Üst', children: [{ id: 'd', type: 'bullet', text: 'Alt' }] },
  ];
  const created = await api.post('/api/pages').set('Authorization', omer.auth).send({ title: 'Bloklar', content });
  assert.equal(created.status, 201);
  const patched = await api
    .patch(`/api/pages/${created.body.id}`)
    .set('Authorization', omer.auth)
    .send({ content: [{ ...content[0], collapsed: true }, content[1]] });
  assert.equal(patched.status, 200);
  const got = await api.get(`/api/pages/${created.body.id}`).set('Authorization', omer.auth);
  assert.equal(got.body.content[0].collapsed, true);
  assert.equal(got.body.content[1].children[0].text, 'Alt');
});
