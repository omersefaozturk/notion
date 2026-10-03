import express from 'express';
import cors from 'cors';
import fs from 'node:fs';
import path from 'node:path';
import { requireAuth } from './auth.js';
import { HttpError } from './lib/errors.js';
import authRoutes from './routes/auth.js';
import householdRoutes from './routes/household.js';
import eventRoutes from './routes/events.js';
import taskRoutes from './routes/tasks.js';
import goalRoutes from './routes/goals.js';
import pageRoutes from './routes/pages.js';
import calendarRoutes from './routes/calendar.js';
import dashboardRoutes from './routes/dashboard.js';

/**
 * Build the Express app.
 * @param {{ db: ReturnType<typeof import('./db.js').createDb>, staticDir?: string }} opts
 */
export function createApp({ db, staticDir } = {}) {
  if (!db) throw new Error('createApp requires a db');
  const app = express();
  app.disable('x-powered-by');
  app.set('query parser', 'simple');
  app.use(cors());
  app.use(express.json({ limit: '5mb' }));

  const api = express.Router();
  api.get('/health', (_req, res) => res.json({ ok: true }));
  api.use('/auth', authRoutes(db));

  const auth = requireAuth(db);
  api.use('/household', auth, householdRoutes(db));
  api.use('/events', auth, eventRoutes(db));
  api.use('/tasks', auth, taskRoutes(db));
  api.use('/goals', auth, goalRoutes(db));
  api.use('/pages', auth, pageRoutes(db));
  api.use('/calendar', auth, calendarRoutes(db));
  api.use('/dashboard', auth, dashboardRoutes(db));
  api.use((_req, res) => res.status(404).json({ error: 'İstenen adres bulunamadı' }));

  app.use('/api', api);

  if (staticDir && fs.existsSync(path.join(staticDir, 'index.html'))) {
    app.use(express.static(staticDir));
    app.get(/^(?!\/api(\/|$)).*/, (_req, res) => res.sendFile(path.join(staticDir, 'index.html')));
  }

  // eslint-disable-next-line no-unused-vars
  app.use((err, _req, res, _next) => {
    if (err instanceof HttpError) return res.status(err.status).json({ error: err.message });
    if (err?.type === 'entity.parse.failed') return res.status(400).json({ error: 'Geçersiz JSON gövdesi' });
    if (err?.type === 'entity.too.large') return res.status(413).json({ error: 'İstek gövdesi çok büyük' });
    // unique violation (e.g. two simultaneous registrations with the same e-mail)
    if (err?.code === '23505') return res.status(409).json({ error: 'Bu kayıt zaten mevcut' });
    console.error(err);
    res.status(500).json({ error: 'Sunucu hatası' });
  });

  return app;
}
