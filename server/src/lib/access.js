import { forbidden, notFound } from './errors.js';

/**
 * SQL fragment restricting rows (table alias `t`) to the requested scope.
 *  mine    → items I own (private + shared)
 *  partner → shared items owned by other household members
 *  merged  → everything I can see
 */
export function scopeClause(user, scope = 'merged', alias = 't') {
  switch (scope) {
    case 'mine':
      return { sql: `${alias}.owner_id = ?`, params: [user.id] };
    case 'partner':
      return {
        sql: `${alias}.household_id = ? AND ${alias}.owner_id <> ? AND ${alias}.visibility = 'shared'`,
        params: [user.householdId, user.id],
      };
    default:
      return visibleClause(user, alias);
  }
}

/** SQL fragment: rows visible to the user at all. */
export function visibleClause(user, alias = 't') {
  return {
    sql: `${alias}.household_id = ? AND (${alias}.owner_id = ? OR ${alias}.visibility = 'shared')`,
    params: [user.householdId, user.id],
  };
}

/** Owner summary columns for a users table alias. */
export function ownerColumns(alias = 'o', prefix = 'o') {
  return `${alias}.id AS ${prefix}_id, ${alias}.name AS ${prefix}_name, ${alias}.initial AS ${prefix}_initial, ${alias}.color AS ${prefix}_color`;
}

export function ownerFromRow(row, prefix = 'o') {
  if (row[`${prefix}_id`] == null) return null;
  return {
    id: row[`${prefix}_id`],
    name: row[`${prefix}_name`],
    initial: row[`${prefix}_initial`],
    color: row[`${prefix}_color`],
  };
}

export function ownerSummary(user) {
  return { id: user.id, name: user.name, initial: user.initial, color: user.color };
}

/**
 * Throws 403 unless the user owns the item. A non-owner may still change
 * `allowedKeys` on a shared item; other provided keys must equal the current values.
 */
export function assertCanEdit(user, row, changes = {}, allowedKeys = [], currentValues = {}) {
  if (row.owner_id === user.id) return;
  if (row.visibility !== 'shared' || allowedKeys.length === 0) {
    throw forbidden('Bu öğeyi yalnızca sahibi düzenleyebilir');
  }
  for (const [key, value] of Object.entries(changes)) {
    if (value === undefined || allowedKeys.includes(key)) continue;
    if (key in currentValues && currentValues[key] === value) continue;
    throw forbidden('Bu öğeyi yalnızca sahibi düzenleyebilir');
  }
}

export function assertOwner(user, row) {
  if (row.owner_id !== user.id) throw forbidden('Bu öğeyi yalnızca sahibi silebilir');
}

export function orNotFound(row, msg) {
  if (!row) throw notFound(msg);
  return row;
}

/** Build a dynamic UPDATE from a map of column → value (undefined = skip). */
export function buildUpdate(table, id, columns) {
  const entries = Object.entries(columns).filter(([, v]) => v !== undefined);
  if (entries.length === 0) return null;
  const set = entries.map(([c]) => `${c === 'end' ? '"end"' : c} = ?`).join(', ');
  return { sql: `UPDATE ${table} SET ${set} WHERE id = ?`, params: [...entries.map(([, v]) => v), id] };
}
