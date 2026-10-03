import { useEffect, useRef } from 'react';

const EMOJIS = [
  '📄', '📝', '📒', '📓', '📚', '🗒️', '🗓️', '📆', '📅', '✅', '🎯', '⭐', '💡', '📌', '📍', '🔖',
  '🏠', '🛒', '🍳', '🍽️', '☕', '🧺', '🧹', '🪴', '🌱', '🌸', '🌞', '🌙', '❤️', '💕', '💍', '👨‍👩‍👧',
  '✈️', '🏖️', '🏔️', '🚗', '🎉', '🎁', '🎂', '🎬', '🎵', '📷', '💰', '💳', '📈', '🏋️', '🧘', '🩺',
  '💼', '💻', '📱', '🔧', '🧠', '📖', '🐶', '🐱', '⚽', '🎮', '🍀', '🔥',
];

export function EmojiPicker({ onSelect, onRemove, onClose }: { onSelect: (e: string) => void; onRemove?: () => void; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [onClose]);
  return (
    <div ref={ref} className="absolute left-0 top-full z-40 mt-1 w-72 rounded-lg border border-neutral-200 bg-white p-2 shadow-lg">
      <div className="mb-1 flex items-center justify-between px-1">
        <span className="text-xs font-medium text-neutral-500">Simge seç</span>
        {onRemove && (
          <button type="button" onClick={onRemove} className="rounded px-1.5 py-0.5 text-xs text-neutral-500 hover:bg-neutral-100">
            Kaldır
          </button>
        )}
      </div>
      <div className="grid grid-cols-8 gap-0.5">
        {EMOJIS.map((e) => (
          <button key={e} type="button" onClick={() => onSelect(e)} className="flex h-8 w-8 items-center justify-center rounded text-xl hover:bg-neutral-100">
            {e}
          </button>
        ))}
      </div>
    </div>
  );
}
