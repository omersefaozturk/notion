// Applies sql/schema.sql (idempotent) and normalises legacy event times.
// Usage: npm run db:migrate   (uses DATABASE_URL, or the local PGlite database)
import { createDb, applySchema } from './db.js';
import { migrateEventTimes } from './services/events.js';

const db = createDb({ ensure: false });
try {
  await applySchema(db);
  const changed = await migrateEventTimes(db);
  console.log(`Şema uygulandı (${db.kind === 'postgres' ? 'PostgreSQL' : 'PGlite'}).`);
  if (changed) console.log(`${changed} etkinliğin zaman biçimi düzeltildi.`);
} finally {
  await db.close();
}
