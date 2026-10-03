import crypto from 'node:crypto';
import { ownerSummary } from './access.js';

export const PALETTE = ['#2563eb', '#db2777', '#16a34a', '#ea580c', '#7c3aed', '#0891b2', '#ca8a04', '#dc2626'];
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export async function generateInviteCode(db) {
  for (;;) {
    let code = '';
    for (const b of crypto.randomBytes(8)) code += CODE_ALPHABET[b % CODE_ALPHABET.length];
    if (!(await db.one('SELECT 1 FROM households WHERE invite_code = ?', [code]))) return code;
  }
}

export async function pickColor(db, householdId) {
  if (householdId == null) return PALETTE[0];
  const rows = await db.many('SELECT color FROM users WHERE household_id = ?', [householdId]);
  const used = new Set(rows.map((r) => r.color.toLowerCase()));
  return PALETTE.find((c) => !used.has(c)) || PALETTE[used.size % PALETTE.length];
}

export async function householdMembers(db, householdId) {
  const rows = await db.many('SELECT id, name, initial, color FROM users WHERE household_id = ? ORDER BY id', [householdId]);
  return rows.map(ownerSummary);
}

export async function getHousehold(db, householdId) {
  const [h, members] = await Promise.all([
    db.one('SELECT * FROM households WHERE id = ?', [householdId]),
    householdMembers(db, householdId),
  ]);
  return { id: h.id, name: h.name, inviteCode: h.invite_code, members };
}

/** First character, upper-cased with Turkish rules. */
export function toInitial(s) {
  const ch = Array.from(String(s).trim())[0] || '?';
  return ch.toLocaleUpperCase('tr-TR');
}
