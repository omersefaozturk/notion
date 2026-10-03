import { z } from 'zod';
import { badRequest } from './errors.js';
import { isDateString, isIsoString, isValidTimeZone } from './dates.js';

const LABELS = {
  name: 'Ad',
  email: 'E-posta',
  password: 'Şifre',
  initial: 'Baş harf',
  color: 'Renk',
  inviteCode: 'Davet kodu',
  title: 'Başlık',
  description: 'Açıklama',
  start: 'Başlangıç',
  end: 'Bitiş',
  allDay: 'Tüm gün',
  location: 'Konum',
  visibility: 'Görünürlük',
  status: 'Durum',
  priority: 'Öncelik',
  dueDate: 'Son tarih',
  dueFrom: 'Son tarih başlangıcı',
  dueTo: 'Son tarih bitişi',
  assigneeId: 'Atanan kişi',
  position: 'Sıra',
  period: 'Dönem',
  periodStart: 'Dönem başlangıcı',
  progress: 'İlerleme',
  done: 'Tamamlandı',
  icon: 'Simge',
  parentId: 'Üst sayfa',
  content: 'İçerik',
  scope: 'Kapsam',
  from: 'Başlangıç tarihi',
  to: 'Bitiş tarihi',
  date: 'Tarih',
  tz: 'Saat dilimi',
};

function label(path) {
  const key = path?.length ? path[path.length - 1] : undefined;
  if (key === undefined) return 'İstek gövdesi';
  if (typeof key === 'number') return `${label(path.slice(0, -1))} (${key + 1}. öğe)`;
  return LABELS[key] || key;
}

z.config({
  customError: (iss) => {
    const l = label(iss.path);
    switch (iss.code) {
      case 'invalid_type':
        if (iss.input === undefined) return `${l} zorunludur`;
        return `${l} geçersiz`;
      case 'too_small':
        if (iss.origin === 'string') {
          return iss.minimum <= 1 ? `${l} boş olamaz` : `${l} en az ${iss.minimum} karakter olmalıdır`;
        }
        if (iss.origin === 'number') return `${l} en az ${iss.minimum} olmalıdır`;
        return `${l} çok kısa`;
      case 'too_big':
        if (iss.origin === 'string') return `${l} en fazla ${iss.maximum} karakter olabilir`;
        if (iss.origin === 'number') return `${l} en fazla ${iss.maximum} olabilir`;
        return `${l} çok uzun`;
      case 'invalid_format':
        if (iss.format === 'email') return 'Geçerli bir e-posta adresi girin';
        return `${l} biçimi geçersiz`;
      case 'invalid_value':
        return `${l} için geçersiz değer`;
      default:
        return `${l} geçersiz`;
    }
  },
});

export { z };

export const visibility = z.enum(['shared', 'private']);
export const scope = z.enum(['mine', 'partner', 'merged']).default('merged');
export const period = z.enum(['daily', 'weekly', 'monthly']);
export const taskStatus = z.enum(['todo', 'doing', 'done']);
export const priority = z.enum(['low', 'medium', 'high']);
export const color = z
  .string()
  .trim()
  .regex(/^#[0-9a-fA-F]{6}$/, { error: 'Renk #RRGGBB biçiminde olmalıdır' });
export const dateStr = z.string().trim().refine(isDateString, {
  error: (iss) => `${label(iss.path)} YYYY-AA-GG biçiminde olmalıdır`,
});
export const isoStr = z.string().trim().refine(isIsoString, {
  error: (iss) => `${label(iss.path)} geçerli bir tarih/saat olmalıdır`,
});
/** Optional IANA time zone (e.g. "Europe/Istanbul") sent by the client. */
export const tz = z
  .string()
  .trim()
  .refine(isValidTimeZone, { error: 'Saat dilimi geçersiz' })
  .optional();
export const id = z.coerce.number().int().positive();
/** Accept "" / null as null for optional nullable strings. */
export const nullableDate = z.preprocess((v) => (v === '' ? null : v), dateStr.nullable());

export function parse(schema, data) {
  const result = schema.safeParse(data ?? {});
  if (!result.success) throw badRequest(result.error.issues[0]?.message || 'Geçersiz istek');
  return result.data;
}

export function parseId(value) {
  const n = Number(value);
  if (!Number.isInteger(n) || n <= 0) throw badRequest('Geçersiz kimlik');
  return n;
}
