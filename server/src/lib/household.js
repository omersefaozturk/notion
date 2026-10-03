import crypto from 'node:crypto';
import { ownerSummary } from './access.js';

export const PALETTE = ['#2563eb', '#db2777', '#16a34a', '#ea580c', '#7c3aed', '#0891b2', '#ca8a04', '#dc2626'];
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export function generateInviteCode(db) {
  const exists = db.prepare('SELECT 1 FROM households WHERE invite_code = ?');
  for (;;) {
    let code = '';
    for (const b of crypto.randomBytes(8)) code += CODE_ALPHABET[b % CODE_ALPHABET.length];
    if (!exists.get(code)) return code;
  }
}

export function pickColor(db, householdId) {
  if (householdId == null) return PALETTE[0];
  const used = new Set(db.prepare('SELECT color FROM users WHERE household_id = ?').all(householdId).map((r) => r.color.toLowerCase()));
  return PALETTE.find((c) => !used.has(c)) || PALETTE[used.size % PALETTE.length];
}

export function householdMembers(db, householdId) {
  return db
    .prepare('SELECT id, name, initial, color FROM users WHERE household_id = ? ORDER BY id')
    .all(householdId)
    .map(ownerSummary);
}

export function getHousehold(db, householdId) {
  const h = db.prepare('SELECT * FROM households WHERE id = ?').get(householdId);
  return { id: h.id, name: h.name, inviteCode: h.invite_code, members: householdMembers(db, householdId) };
}

/** First character, upper-cased with Turkish rules. */
export function toInitial(s) {
  const ch = Array.from(String(s).trim())[0] || '?';
  return ch.toLocaleUpperCase('tr-TR');
}
