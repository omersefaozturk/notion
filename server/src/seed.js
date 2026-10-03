// Wipes the database and recreates demo data relative to today.
import bcrypt from 'bcryptjs';
import { pathToFileURL } from 'node:url';
import { openDb, transaction } from './db.js';
import { generateInviteCode } from './lib/household.js';
import {
  today, addDays, startOfWeek, startOfMonth, normalizePeriodStart, periodEnd, nowIso, zonedToUtc, DEFAULT_TZ,
} from './lib/dates.js';

const uid = () => crypto.randomUUID();
const block = (type, text = '', extra = {}) => ({ id: uid(), type, text, checked: false, children: [], ...extra });

/**
 * Wall-clock time on a date in the household time zone (APP_TIMEZONE, default
 * Europe/Istanbul) → UTC ISO string. Independent of the server's own TZ.
 */
function at(date, hh, mm = 0) {
  return zonedToUtc(date, hh, mm, DEFAULT_TZ).toISOString();
}

export function seed(db) {
  const now = nowIso();
  const t = today();
  const dow = (new Date(`${t}T00:00:00Z`).getUTCDay() + 6) % 7; // Mon = 0
  const sat = dow === 5 ? t : dow === 6 ? addDays(t, -1) : addDays(startOfWeek(t), 5);
  const sun = addDays(sat, 1);
  const weekStart = startOfWeek(t);
  const monthStart = startOfMonth(t);
  const hash = bcrypt.hashSync('123456', 10);

  return transaction(db, () => {
    db.exec('DELETE FROM pages; DELETE FROM goals; DELETE FROM tasks; DELETE FROM events; DELETE FROM users; DELETE FROM households;');
    db.exec("DELETE FROM sqlite_sequence;");

    const hid = Number(
      db.prepare('INSERT INTO households (name, invite_code, created_at) VALUES (?, ?, ?)')
        .run('Bizim Ev', generateInviteCode(db), now).lastInsertRowid,
    );
    const addUser = (name, email, initial, color) =>
      Number(
        db.prepare(
          'INSERT INTO users (household_id, name, email, password_hash, initial, color, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
        ).run(hid, name, email, hash, initial, color, now).lastInsertRowid,
      );
    const omer = addUser('Ömer', 'omer@example.com', 'Ö', '#2563eb');
    const es = addUser('Eşim', 'es@example.com', 'E', '#db2777');

    // ---- Events
    const ev = db.prepare(
      `INSERT INTO events (household_id, owner_id, title, description, start, "end", all_day, location, color, visibility,
         created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    );
    const event = (owner, title, start, end, { allDay = false, location = '', description = '', color = null, visibility = 'shared' } = {}) =>
      ev.run(hid, owner, title, description, start, end, allDay ? 1 : 0, location, color, visibility, now, now);

    event(omer, 'Spor salonu', at(t, 18), at(t, 19, 30), { location: 'MacFit' });
    event(es, 'Yoga dersi', at(t, 9), at(t, 10), { location: 'Stüdyo' });
    event(omer, 'Annemlerde kahvaltı', at(sat, 10), at(sat, 12), { location: 'Kadıköy', description: 'Börek götürmeyi unutma' });
    event(es, 'Sinema gecesi', at(sat, 20), at(sat, 22, 30), { location: 'Zorlu PSM' });
    event(es, 'Piknik', sun, sun, { allDay: true, location: 'Belgrad Ormanı', color: '#16a34a' });
    event(omer, 'Bisiklet turu', at(sun, 8), at(sun, 10), { location: 'Sahil yolu' });
    event(es, 'Ömer için doğum günü hediyesi', at(sun, 15), at(sun, 16), { visibility: 'private' });
    event(omer, 'Ekip toplantısı', at(addDays(weekStart, 7), 10), at(addDays(weekStart, 7), 11), { location: 'Ofis' });
    event(es, 'Diş hekimi', at(addDays(t, 4), 14), at(addDays(t, 4), 15), { location: 'Nişantaşı' });
    event(omer, 'Arkadaşlarla maç', at(addDays(t, 5), 21), at(addDays(t, 5), 23), { visibility: 'private' });
    event(es, 'Kitap kulübü', at(addDays(monthStart, 14), 19), at(addDays(monthStart, 14), 21));
    event(omer, 'Fatura ödeme günü', addDays(monthStart, 19), addDays(monthStart, 19), { allDay: true, color: '#ea580c' });
    event(es, 'Kuaför', at(addDays(t, -2), 11), at(addDays(t, -2), 12));
    event(omer, 'Akşam yemeği - Karaköy', at(addDays(t, 2), 20), at(addDays(t, 2), 22), { location: 'Karaköy Lokantası' });

    // ---- Tasks
    const tk = db.prepare(
      `INSERT INTO tasks (household_id, owner_id, assignee_id, title, description, status, priority, due_date, position,
         visibility, created_at, updated_at, completed_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    );
    const pos = { todo: 0, doing: 0, done: 0 };
    const task = (owner, title, status, { priority = 'medium', due = null, assignee = null, description = '', visibility = 'shared' } = {}) => {
      pos[status] += 1024;
      tk.run(hid, owner, assignee, title, description, status, priority, due, pos[status], visibility, now, now,
        status === 'done' ? now : null);
    };
    task(omer, 'Market alışverişi', 'todo', { priority: 'high', due: t, assignee: es });
    task(es, 'Çamaşırları katla', 'todo', { due: addDays(t, 1) });
    task(omer, 'Araba muayenesi randevusu al', 'todo', { priority: 'high', due: addDays(t, 3) });
    task(es, 'Tatil otelini araştır', 'todo', { priority: 'low', due: addDays(t, 10), assignee: omer });
    task(omer, 'Sürpriz parti hazırlığı', 'todo', { visibility: 'private', due: addDays(t, 6) });
    task(es, 'Salonu boya', 'doing', { priority: 'medium', due: sun });
    task(omer, 'Vergi beyannamesi', 'doing', { priority: 'high', due: addDays(t, 2) });
    task(es, 'Fotoğraf albümü düzenle', 'doing', { priority: 'low', visibility: 'private' });
    task(omer, 'Elektrik faturasını öde', 'done', { due: addDays(t, -1) });
    task(es, 'Veteriner randevusu', 'done', { priority: 'high', due: addDays(t, -3) });
    task(omer, 'Bulaşık makinesi filtresini temizle', 'done', { priority: 'low' });

    // ---- Goals
    const gl = db.prepare(
      `INSERT INTO goals (household_id, owner_id, title, description, period, period_start, period_end, progress, done,
         visibility, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    );
    const goal = (owner, title, period, date, progress = 0, visibility = 'shared') => {
      const start = normalizePeriodStart(period, date);
      gl.run(hid, owner, title, '', period, start, periodEnd(period, start), progress, progress === 100 ? 1 : 0,
        visibility, now, now);
    };
    goal(omer, '10.000 adım yürü', 'daily', t, 40);
    goal(omer, '2 litre su iç', 'daily', t, 100);
    goal(es, '30 dakika kitap oku', 'daily', t, 50);
    goal(es, 'Meditasyon yap', 'daily', t, 0, 'private');
    goal(omer, '3 kez spor', 'weekly', t, 33);
    goal(es, 'Haftalık yemek planı çıkar', 'weekly', t, 100);
    goal(es, 'Birlikte bir film izle', 'weekly', t, 0);
    goal(omer, '2 kitap bitir', 'monthly', t, 50);
    goal(es, 'Aylık bütçeyi tuttur', 'monthly', t, 70);
    goal(omer, 'Yeni bir tarif dene', 'monthly', t, 0, 'private');

    // ---- Pages
    const pg = db.prepare(
      `INSERT INTO pages (household_id, owner_id, parent_id, title, icon, content, period, period_start, period_end,
         visibility, position, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    );
    let pagePos = 0;
    const page = (owner, title, icon, content, { parent = null, period = null, date = null, visibility = 'shared' } = {}) => {
      const start = period ? normalizePeriodStart(period, date) : null;
      pagePos += 1024;
      return Number(
        pg.run(hid, owner, parent, title, icon, JSON.stringify(content), period, start,
          period ? periodEnd(period, start) : null, visibility, pagePos, now, now).lastInsertRowid,
      );
    };

    const home = page(omer, 'Ev İşleri', '🏠', [
      block('heading1', 'Ev İşleri'),
      block('paragraph', 'Evle ilgili ortak notlarımız.'),
      block('todo', 'Mutfak dolabını düzenle'),
      block('todo', 'Perdeleri yıka', { checked: true }),
    ]);
    page(es, 'Market Listesi', '🛒', [
      block('todo', 'Süt'),
      block('todo', 'Yumurta', { checked: true }),
      block('todo', 'Domates'),
      block('todo', 'Zeytinyağı'),
    ], { parent: home });
    page(omer, 'Tamirat Listesi', '🔧', [block('bullet', 'Banyo musluğu damlatıyor'), block('bullet', 'Balkon kapısı')], { parent: home });
    const trip = page(es, 'Tatil Planı', '🏖️', [
      block('heading1', 'Yaz tatili'),
      block('callout', 'Bütçe: 40.000 ₺'),
      block('toggle', 'Seçenekler', { children: [block('bullet', 'Kaş'), block('bullet', 'Ayvalık')] }),
      block('quote', 'Deniz, kum, güneş!'),
    ]);
    page(es, 'Bavul Listesi', '🧳', [block('todo', 'Güneş kremi'), block('todo', 'Mayo')], { parent: trip });
    page(omer, 'Tarifler', '🍲', [block('heading2', 'Mercimek çorbası'), block('numbered', 'Soğanı kavur'), block('numbered', 'Mercimeği ekle')]);
    page(omer, 'Kişisel Notlar', '📓', [block('paragraph', 'Sadece bana özel notlar.')], { visibility: 'private' });

    page(omer, 'Günlük Plan', '📅', [block('heading2', 'Bugün'), block('todo', 'Faturaları kontrol et'), block('todo', 'Spor')], { period: 'daily', date: t });
    page(es, 'Günlük Plan', '🌸', [block('todo', 'Yoga'), block('todo', 'Kitap oku')], { period: 'daily', date: t });
    page(omer, 'Haftalık Plan', '🗓️', [block('heading2', 'Bu hafta'), block('bullet', 'Hafta sonu annemlere git'), block('bullet', 'Vergi işini bitir')], { period: 'weekly', date: weekStart });
    page(es, 'Haftalık Plan', '🗓️', [block('bullet', 'Salonu boya'), block('bullet', 'Piknik hazırlığı')], { period: 'weekly', date: weekStart });
    page(omer, 'Aylık Plan', '📆', [block('heading1', 'Bu ay'), block('todo', '2 kitap bitir'), block('todo', 'Bütçeyi gözden geçir')], { period: 'monthly', date: monthStart });
    page(es, 'Aylık Hedefler ve Plan', '✨', [block('todo', 'Aylık bütçe'), block('todo', 'Yeni hobi')], { period: 'monthly', date: monthStart, visibility: 'private' });

    return { householdId: hid, users: { omer, es } };
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const db = openDb();
  const result = seed(db);
  const code = db.prepare('SELECT invite_code FROM households WHERE id = ?').get(result.householdId).invite_code;
  db.close();
  console.log('Örnek veriler oluşturuldu.');
  console.log('  omer@example.com / 123456');
  console.log('  es@example.com   / 123456');
  console.log(`  Davet kodu: ${code}`);
}
