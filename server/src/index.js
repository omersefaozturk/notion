import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createDb } from './db.js';
import { createApp } from './app.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT) || 3001;

const db = createDb();
await db.ready();
const app = createApp({ db, staticDir: path.resolve(__dirname, '../../client/dist') });

const server = app.listen(PORT, () => {
  const where = db.kind === 'postgres' ? 'PostgreSQL (DATABASE_URL)' : 'PGlite (yerel)';
  console.log(`Ortak Plan API http://localhost:${PORT} adresinde çalışıyor — veritabanı: ${where}`);
});

function shutdown() {
  server.close(async () => {
    await db.close().catch(() => {});
    process.exit(0);
  });
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
