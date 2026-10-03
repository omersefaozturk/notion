import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { openDb } from './db.js';
import { createApp } from './app.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT) || 3001;

const db = openDb();
const app = createApp({ db, staticDir: path.resolve(__dirname, '../../client/dist') });

const server = app.listen(PORT, () => {
  console.log(`Ortak Plan API http://localhost:${PORT} adresinde çalışıyor`);
});

function shutdown() {
  server.close(() => {
    db.close();
    process.exit(0);
  });
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
