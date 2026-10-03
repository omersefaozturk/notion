import { useEffect, useRef } from 'react';
import type { BlockType } from '../../api/types';
import { BLOCK_TYPES } from '../../lib/blocks';
import { cx } from '../../lib/util';

export function filterBlockTypes(query: string) {
  const q = query.trim().toLocaleLowerCase('tr-TR');
  if (!q) return BLOCK_TYPES;
  return BLOCK_TYPES.filter((t) => t.label.toLocaleLowerCase('tr-TR').includes(q) || t.keywords.includes(q));
}

export function SlashMenu({
  query,
  index,
  onSelect,
  onHover,
}: {
  query: string;
  index: number;
  onSelect: (type: BlockType) => void;
  onHover: (i: number) => void;
}) {
  const items = filterBlockTypes(query);
  const listRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = listRef.current?.querySelector<HTMLElement>(`[data-idx="${index}"]`);
    el?.scrollIntoView({ block: 'nearest' });
  }, [index]);

  return (
    <div
      ref={listRef}
      className="absolute left-6 top-full z-30 mt-1 max-h-72 w-64 overflow-y-auto rounded-lg border border-neutral-200 bg-white py-1 shadow-lg"
      onMouseDown={(e) => e.preventDefault()}
    >
      <div className="px-3 py-1 text-[11px] font-medium uppercase tracking-wide text-neutral-400">Blok türü</div>
      {items.length === 0 && <div className="px-3 py-2 text-sm text-neutral-400">Sonuç yok</div>}
      {items.map((t, i) => (
        <button
          key={t.type}
          type="button"
          data-idx={i}
          onMouseEnter={() => onHover(i)}
          onClick={() => onSelect(t.type)}
          className={cx('flex w-full items-center gap-3 px-3 py-1.5 text-left', i === index ? 'bg-neutral-100' : 'hover:bg-neutral-50')}
        >
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded border border-neutral-200 bg-white text-xs font-semibold text-neutral-600">
            {t.icon}
          </span>
          <span>
            <span className="block text-sm text-neutral-800">{t.label}</span>
            <span className="block text-xs text-neutral-400">{t.hint}</span>
          </span>
        </button>
      ))}
    </div>
  );
}
