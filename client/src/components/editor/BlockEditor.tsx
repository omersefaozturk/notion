import { useLayoutEffect, useRef, useState, type Dispatch, type KeyboardEvent, type SetStateAction } from 'react';
import type { Block, BlockType } from '../../api/types';
import {
  convertBlock,
  findBlock,
  flattenVisible,
  indentBlock,
  INDENTABLE_TYPES,
  insertAfter,
  insertFirstChild,
  isToggleOpen,
  newBlock,
  outdentBlock,
  removeBlock,
  updateBlock,
} from '../../lib/blocks';
import { cx } from '../../lib/util';
import { Checkbox } from '../ui';
import { filterBlockTypes, SlashMenu } from './SlashMenu';

type FocusTarget = { id: string; caret: 'start' | 'end' | number };

interface SlashState {
  blockId: string;
  start: number; // index of "/" in text
  query: string;
  index: number;
}

interface Props {
  blocks: Block[];
  setBlocks: Dispatch<SetStateAction<Block[]>>;
  readOnly: boolean;
}

const LIST_TYPES: BlockType[] = ['todo', 'bullet', 'numbered', 'toggle'];

const PLACEHOLDERS: Partial<Record<BlockType, string>> = {
  heading1: 'Başlık 1',
  heading2: 'Başlık 2',
  heading3: 'Başlık 3',
  todo: 'Yapılacak',
  bullet: 'Liste',
  numbered: 'Liste',
  toggle: 'Açılır liste',
  quote: 'Alıntı',
  callout: 'Not',
  code: 'Kod',
};

const TEXT_STYLES: Record<BlockType, string> = {
  paragraph: 'text-[15px] leading-7',
  heading1: 'text-3xl font-bold leading-tight',
  heading2: 'text-2xl font-semibold leading-snug',
  heading3: 'text-xl font-semibold leading-snug',
  todo: 'text-[15px] leading-7',
  bullet: 'text-[15px] leading-7',
  numbered: 'text-[15px] leading-7',
  quote: 'text-[15px] leading-7',
  divider: '',
  callout: 'text-[15px] leading-7',
  code: 'font-mono text-[13px] leading-6',
  toggle: 'text-[15px] leading-7',
};

const WRAP_STYLES: Partial<Record<BlockType, string>> = {
  heading1: 'mt-6 mb-1',
  heading2: 'mt-4 mb-0.5',
  heading3: 'mt-3',
  quote: 'border-l-[3px] border-neutral-800 pl-3 my-1',
  callout: 'my-1 rounded-md bg-neutral-100 px-3 py-2',
  code: 'my-1 rounded-md bg-neutral-100 px-3 py-2',
};

function AutoTextarea({
  value,
  className,
  setRef,
  ...rest
}: Omit<React.TextareaHTMLAttributes<HTMLTextAreaElement>, 'value'> & {
  value: string;
  setRef: (el: HTMLTextAreaElement | null) => void;
}) {
  const ref = useRef<HTMLTextAreaElement | null>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = '0px';
    el.style.height = `${el.scrollHeight}px`;
  }, [value]);
  return (
    <textarea
      ref={(el) => {
        ref.current = el;
        setRef(el);
      }}
      rows={1}
      value={value}
      spellCheck
      className={cx('block w-full resize-none overflow-hidden bg-transparent outline-none placeholder:text-neutral-300', className)}
      {...rest}
    />
  );
}

export function BlockEditor({ blocks, setBlocks, readOnly }: Props) {
  const refs = useRef(new Map<string, HTMLElement>());
  const pendingFocus = useRef<FocusTarget | null>(null);
  // Read-only viewers can open/close toggles locally without changing the page.
  const [localOpen, setLocalOpen] = useState<Map<string, boolean>>(() => new Map());
  const [focusedId, setFocusedId] = useState<string | null>(null);
  const [slash, setSlash] = useState<SlashState | null>(null);
  const [, setFocusTick] = useState(0);

  useLayoutEffect(() => {
    const target = pendingFocus.current;
    if (!target) return;
    const el = refs.current.get(target.id);
    if (!el) return;
    pendingFocus.current = null;
    el.focus();
    if (el instanceof HTMLTextAreaElement) {
      const len = el.value.length;
      const pos = target.caret === 'start' ? 0 : target.caret === 'end' ? len : Math.min(target.caret, len);
      el.setSelectionRange(pos, pos);
    }
  });

  const focus = (id: string, caret: FocusTarget['caret']) => {
    pendingFocus.current = { id, caret };
    // Trigger a layout pass even when no other state changes.
    setFocusTick((t) => t + 1);
  };

  const isOpen = (b: Block) => (localOpen.has(b.id) ? !!localOpen.get(b.id) : isToggleOpen(b));
  const visible = flattenVisible(blocks, isOpen);
  const visibleIndex = (id: string) => visible.findIndex((b) => b.id === id);

  const setText = (id: string, text: string) => setBlocks((prev) => updateBlock(prev, id, (b) => ({ ...b, text })));

  /** Open/close a toggle. The state is stored on the block (`collapsed`) so it persists. */
  const toggleExpanded = (block: Block) => {
    const open = !isOpen(block);
    if (readOnly) {
      setLocalOpen((prev) => new Map(prev).set(block.id, open));
      return;
    }
    setBlocks((prev) => updateBlock(prev, block.id, (b) => ({ ...b, collapsed: !open })));
  };

  /* ----------------------------- slash menu ----------------------------- */

  function applySlash(type: BlockType) {
    if (!slash) return;
    const block = findBlock(blocks, slash.blockId);
    if (!block) return;
    const el = refs.current.get(block.id);
    const caret = el instanceof HTMLTextAreaElement ? el.selectionStart : slash.start + 1 + slash.query.length;
    const remaining = block.text.slice(0, slash.start) + block.text.slice(caret);
    setSlash(null);
    if (remaining.trim() === '') {
      const converted = convertBlock({ ...block, text: '' }, type);
      setBlocks((prev) => updateBlock(prev, block.id, () => converted));
      if (type === 'divider') {
        const after = newBlock('paragraph');
        setBlocks((prev) => insertAfter(prev, block.id, after));
        focus(after.id, 'start');
      } else {
        focus(block.id, 'start');
      }
    } else {
      const nb = newBlock(type);
      setBlocks((prev) => insertAfter(updateBlock(prev, block.id, (b) => ({ ...b, text: remaining })), block.id, nb));
      if (type === 'divider') {
        const after = newBlock('paragraph');
        setBlocks((prev) => insertAfter(prev, nb.id, after));
        focus(after.id, 'start');
      } else {
        focus(nb.id, 'start');
      }
    }
  }

  function handleChange(block: Block, e: React.ChangeEvent<HTMLTextAreaElement>) {
    const value = e.target.value;
    const caret = e.target.selectionStart;
    setText(block.id, value);
    if (slash && slash.blockId === block.id) {
      if (caret <= slash.start || value[slash.start] !== '/') {
        setSlash(null);
        return;
      }
      const query = value.slice(slash.start + 1, caret);
      if (/\s/.test(query)) setSlash(null);
      else setSlash({ ...slash, query, index: 0 });
      return;
    }
    const typed = value.length === block.text.length + 1 && value[caret - 1] === '/';
    if (typed && block.type !== 'code' && (caret === 1 || /\s/.test(value[caret - 2]))) {
      setSlash({ blockId: block.id, start: caret - 1, query: '', index: 0 });
    }
  }

  /* ------------------------------ keyboard ------------------------------ */

  function handleKeyDown(block: Block, e: KeyboardEvent<HTMLTextAreaElement>) {
    const el = e.currentTarget;
    const { selectionStart: ss, selectionEnd: se } = el;
    const text = el.value;

    if (slash && slash.blockId === block.id) {
      const items = filterBlockTypes(slash.query);
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSlash({ ...slash, index: items.length ? (slash.index + 1) % items.length : 0 });
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSlash({ ...slash, index: items.length ? (slash.index - 1 + items.length) % items.length : 0 });
        return;
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        const item = items[slash.index];
        if (item) applySlash(item.type);
        else setSlash(null);
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        setSlash(null);
        return;
      }
    }

    const idx = visibleIndex(block.id);

    if (e.key === 'Tab' && INDENTABLE_TYPES.includes(block.type)) {
      e.preventDefault();
      setBlocks((prev) => (e.shiftKey ? outdentBlock(prev, block.id) : indentBlock(prev, block.id)));
      focus(block.id, ss);
      return;
    }

    if (e.key === 'Enter' && !e.shiftKey && (block.type !== 'code' || e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      if (LIST_TYPES.includes(block.type) && text === '') {
        setBlocks((prev) => updateBlock(prev, block.id, (b) => convertBlock(b, 'paragraph')));
        return;
      }
      const before = text.slice(0, ss);
      const after = text.slice(se);
      const keepType = block.type === 'todo' || block.type === 'bullet' || block.type === 'numbered';
      const nb = newBlock(keepType ? block.type : 'paragraph', after);
      // An open toggle, or a list item with nested items, gets the new block as its first child.
      const intoChildren = block.type === 'toggle' ? isOpen(block) : !!block.children?.length;
      setBlocks((prev) => {
        const updated = updateBlock(prev, block.id, (b) => ({ ...b, text: before }));
        return intoChildren ? insertFirstChild(updated, block.id, nb) : insertAfter(updated, block.id, nb);
      });
      focus(nb.id, 'start');
      return;
    }

    if (e.key === 'Backspace' && ss === 0 && se === 0) {
      const prev = idx > 0 ? visible[idx - 1] : null;
      if (text === '') {
        e.preventDefault();
        if (!prev) {
          if (block.type !== 'paragraph') setBlocks((p) => updateBlock(p, block.id, (b) => convertBlock(b, 'paragraph')));
          return;
        }
        setBlocks((p) => removeBlock(p, block.id));
        if (prev.type === 'divider') focus(prev.id, 'end');
        else focus(prev.id, 'end');
        return;
      }
      if (block.type !== 'paragraph') {
        e.preventDefault();
        setBlocks((p) => updateBlock(p, block.id, (b) => convertBlock(b, 'paragraph')));
        return;
      }
      if (prev && !(block.type === 'paragraph' && block.children?.length)) {
        e.preventDefault();
        if (prev.type === 'divider') {
          setBlocks((p) => removeBlock(p, prev.id));
          focus(block.id, 'start');
          return;
        }
        const caret = prev.text.length;
        setBlocks((p) => removeBlock(updateBlock(p, prev.id, (b) => ({ ...b, text: b.text + text })), block.id));
        focus(prev.id, caret);
        return;
      }
    }

    if (e.key === 'ArrowUp' && !text.slice(0, ss).includes('\n')) {
      const prev = idx > 0 ? visible[idx - 1] : null;
      if (prev) {
        e.preventDefault();
        focus(prev.id, 'end');
      }
      return;
    }

    if (e.key === 'ArrowDown' && !text.slice(se).includes('\n')) {
      const next = idx < visible.length - 1 ? visible[idx + 1] : null;
      if (next) {
        e.preventDefault();
        focus(next.id, 'start');
      }
    }
  }

  function handleDividerKey(block: Block, e: KeyboardEvent<HTMLDivElement>) {
    if (readOnly) return;
    const idx = visibleIndex(block.id);
    const prev = idx > 0 ? visible[idx - 1] : null;
    const next = idx < visible.length - 1 ? visible[idx + 1] : null;
    if (e.key === 'Backspace' || e.key === 'Delete') {
      e.preventDefault();
      setBlocks((p) => removeBlock(p, block.id));
      const target = prev ?? next;
      if (target) focus(target.id, prev ? 'end' : 'start');
    } else if (e.key === 'ArrowUp' && prev) {
      e.preventDefault();
      focus(prev.id, 'end');
    } else if (e.key === 'ArrowDown' && next) {
      e.preventDefault();
      focus(next.id, 'start');
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const nb = newBlock('paragraph');
      setBlocks((p) => insertAfter(p, block.id, nb));
      focus(nb.id, 'start');
    }
  }

  function openInsertMenu(after: Block) {
    const nb = newBlock('paragraph', '/');
    setBlocks((p) => (after.type === 'toggle' && isOpen(after) ? insertFirstChild(p, after.id, nb) : insertAfter(p, after.id, nb)));
    setSlash({ blockId: nb.id, start: 0, query: '', index: 0 });
    focus(nb.id, 'end');
  }

  function appendAtEnd() {
    if (readOnly) return;
    const last = blocks[blocks.length - 1];
    if (last && last.type === 'paragraph' && last.text === '') {
      focus(last.id, 'start');
      return;
    }
    const nb = newBlock('paragraph');
    setBlocks((p) => [...p, nb]);
    focus(nb.id, 'start');
  }

  /* ------------------------------- render ------------------------------- */

  function renderList(list: Block[], depth: number) {
    let numberCounter = 0;
    return list.map((block) => {
      numberCounter = block.type === 'numbered' ? numberCounter + 1 : 0;
      return renderBlock(block, depth, numberCounter);
    });
  }

  function renderBlock(block: Block, depth: number, number: number) {
    const setRef = (el: HTMLElement | null) => {
      if (el) refs.current.set(block.id, el);
      else refs.current.delete(block.id);
    };
    const open = isOpen(block);

    if (block.type === 'divider') {
      return (
        <div key={block.id} className="group relative flex items-center py-1">
          <div
            ref={setRef}
            tabIndex={readOnly ? -1 : 0}
            onKeyDown={(e) => handleDividerKey(block, e)}
            className="w-full rounded py-2 outline-none focus:bg-blue-50"
          >
            <hr className="border-neutral-200" />
          </div>
        </div>
      );
    }

    const placeholder =
      block.type === 'paragraph' ? (focusedId === block.id && !readOnly ? "Komutlar için '/' yaz…" : '') : PLACEHOLDERS[block.type] ?? '';

    let prefix: React.ReactNode = null;
    if (block.type === 'todo') {
      prefix = (
        <span className="flex h-7 items-center pr-2">
          <Checkbox
            checked={!!block.checked}
            disabled={readOnly}
            label="Tamamlandı"
            onChange={(v) => setBlocks((p) => updateBlock(p, block.id, (b) => ({ ...b, checked: v })))}
          />
        </span>
      );
    } else if (block.type === 'bullet') {
      prefix = <span className="flex h-7 w-6 shrink-0 items-center justify-center text-lg leading-none text-neutral-700">•</span>;
    } else if (block.type === 'numbered') {
      prefix = <span className="flex h-7 min-w-6 shrink-0 items-center justify-end pr-1.5 text-[15px] tabular-nums text-neutral-700">{number}.</span>;
    } else if (block.type === 'toggle') {
      prefix = (
        <button
          type="button"
          onClick={() => toggleExpanded(block)}
          aria-label={open ? 'Daralt' : 'Genişlet'}
          aria-expanded={open}
          className="flex h-7 w-6 shrink-0 items-center justify-center rounded text-xs text-neutral-600 hover:bg-neutral-100"
        >
          <span className={cx('transition-transform', open && 'rotate-90')}>▶</span>
        </button>
      );
    } else if (block.type === 'callout') {
      prefix = <span className="flex h-7 shrink-0 items-center pr-2 text-lg">💡</span>;
    }

    return (
      <div key={block.id} data-block-type={block.type} data-depth={depth}>
        <div className={cx('group relative flex items-start', WRAP_STYLES[block.type])}>
          {!readOnly && (
            <button
              type="button"
              tabIndex={-1}
              title="Blok ekle"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => openInsertMenu(block)}
              className="absolute -left-7 top-1 hidden h-6 w-6 items-center justify-center rounded text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700 group-hover:flex"
            >
              +
            </button>
          )}
          {prefix}
          <AutoTextarea
            setRef={setRef}
            value={block.text}
            readOnly={readOnly}
            placeholder={placeholder}
            onChange={(e) => handleChange(block, e)}
            onKeyDown={(e) => !readOnly && handleKeyDown(block, e)}
            onFocus={() => setFocusedId(block.id)}
            onBlur={() => {
              setFocusedId((f) => (f === block.id ? null : f));
              setSlash((s) => (s && s.blockId === block.id ? null : s));
            }}
            className={cx(
              TEXT_STYLES[block.type],
              'py-0.5 text-neutral-900',
              block.type === 'todo' && block.checked && 'text-neutral-400 line-through',
            )}
          />
          {slash && slash.blockId === block.id && (
            <SlashMenu query={slash.query} index={slash.index} onHover={(i) => setSlash({ ...slash, index: i })} onSelect={applySlash} />
          )}
        </div>
        {block.type !== 'toggle' && block.children && block.children.length > 0 && (
          <div className="pl-6">{renderList(block.children, depth + 1)}</div>
        )}
        {block.type === 'toggle' && open && (
          <div className="pl-6">
            {block.children && block.children.length > 0 ? (
              renderList(block.children, depth + 1)
            ) : (
              <button
                type="button"
                disabled={readOnly}
                onClick={() => {
                  const nb = newBlock('paragraph');
                  setBlocks((p) => insertFirstChild(p, block.id, nb));
                  focus(nb.id, 'start');
                }}
                className="py-1 text-left text-sm text-neutral-400 hover:text-neutral-600 disabled:hover:text-neutral-400"
              >
                {readOnly ? 'Boş açılır liste' : 'Boş açılır liste. Blok eklemek için tıkla.'}
              </button>
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="pl-8">
      {renderList(blocks, 0)}
      {!readOnly && (
        <div className="min-h-[80px] cursor-text" onClick={appendAtEnd} aria-hidden>
          {blocks.length === 0 && <div className="py-1 text-[15px] text-neutral-300">Yazmaya başlamak için tıkla…</div>}
        </div>
      )}
    </div>
  );
}
