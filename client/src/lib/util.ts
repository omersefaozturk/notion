export const COLOR_PALETTE = [
  '#2563eb',
  '#db2777',
  '#16a34a',
  '#ea580c',
  '#7c3aed',
  '#0891b2',
  '#ca8a04',
  '#dc2626',
  '#475569',
];

export function uid(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return 'b-' + Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export function cx(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(' ');
}

export function errorMessage(e: unknown): string {
  if (e instanceof Error) return e.message;
  return 'Beklenmeyen bir hata oluştu.';
}

export const PRIORITY_LABELS = { low: 'Düşük', medium: 'Orta', high: 'Yüksek' } as const;
export const STATUS_LABELS = { todo: 'Yapılacak', doing: 'Yapılıyor', done: 'Yapıldı' } as const;
export const VISIBILITY_LABELS = { shared: 'Ortak', private: 'Özel' } as const;
