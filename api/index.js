// Vercel serverless entry point: the whole Express API runs as one function.
// vercel.json rewrites /api/* here; the original path is kept in req.url, so the
// app's /api/... routes match as they do locally.
import { createDb } from '../server/src/db.js';
import { createApp } from '../server/src/app.js';

// Created once per cold start and reused by warm invocations. With DATABASE_URL
// this is a tiny postgres.js pool (prepared statements off, Supabase pooler-safe).
const db = createDb();
const app = createApp({ db });

export default async function handler(req, res) {
  try {
    // connects and creates the schema on a fresh database (memoised; cheap afterwards)
    await db.ready();
  } catch (err) {
    console.error('Veritabanına bağlanılamadı:', err);
    res.statusCode = 503;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(JSON.stringify({ error: 'Veritabanına şu anda ulaşılamıyor, lütfen biraz sonra tekrar deneyin' }));
    return;
  }
  return app(req, res);
}
