import type { Block, BlockType } from '../api/types';
import { uid } from './util';

export const BLOCK_TYPES: Array<{ type: BlockType; label: string; hint: string; icon: string; keywords: string }> = [
  { type: 'paragraph', label: 'Metin', hint: 'Düz metin', icon: 'Aa', keywords: 'metin paragraf text paragraph' },
  { type: 'heading1', label: 'Başlık 1', hint: 'Büyük başlık', icon: 'H1', keywords: 'baslik başlık heading h1' },
  { type: 'heading2', label: 'Başlık 2', hint: 'Orta başlık', icon: 'H2', keywords: 'baslik başlık heading h2' },
  { type: 'heading3', label: 'Başlık 3', hint: 'Küçük başlık', icon: 'H3', keywords: 'baslik başlık heading h3' },
  { type: 'todo', label: 'Yapılacak', hint: 'Onay kutulu madde', icon: '☑', keywords: 'yapilacak yapılacak todo görev gorev checkbox' },
  { type: 'bullet', label: 'Madde listesi', hint: 'Basit madde', icon: '•', keywords: 'madde liste bullet list' },
  { type: 'numbered', label: 'Numaralı liste', hint: '1, 2, 3…', icon: '1.', keywords: 'numarali numaralı liste numbered' },
  { type: 'toggle', label: 'Açılır liste', hint: 'İçeriği gizle / göster', icon: '▸', keywords: 'acilir açılır toggle' },
  { type: 'quote', label: 'Alıntı', hint: 'Alıntı bloğu', icon: '❝', keywords: 'alinti alıntı quote' },
  { type: 'callout', label: 'Bilgi kutusu', hint: 'Vurgulu not', icon: '💡', keywords: 'bilgi kutu callout not' },
  { type: 'code', label: 'Kod', hint: 'Kod bloğu', icon: '</>', keywords: 'kod code' },
  { type: 'divider', label: 'Ayırıcı', hint: 'Yatay çizgi', icon: '—', keywords: 'ayirici ayırıcı divider cizgi çizgi' },
];

export const BLOCK_TYPE_SET = new Set(BLOCK_TYPES.map((b) => b.type));

/** Block types that can be indented with Tab (nested under the previous block). */
export const INDENTABLE_TYPES: BlockType[] = ['todo', 'bullet', 'numbered', 'toggle'];

export function newBlock(type: BlockType = 'paragraph', text = ''): Block {
  const b: Block = { id: uid(), type, text };
  if (type === 'todo') b.checked = false;
  if (type === 'toggle') {
    b.children = [];
    b.collapsed = false;
  }
  return b;
}

/** Whether a toggle is open. Toggles without a stored state are closed. */
export function isToggleOpen(b: Block): boolean {
  return b.type === 'toggle' && b.collapsed === false;
}

/** Normalise unknown content into a valid block list. */
export function normalizeBlocks(input: unknown): Block[] {
  if (!Array.isArray(input)) return [];
  return input
    .filter((b): b is Record<string, unknown> => !!b && typeof b === 'object')
    .map((b) => {
      const type = (BLOCK_TYPE_SET.has(b.type as BlockType) ? b.type : 'paragraph') as BlockType;
      const block: Block = {
        id: typeof b.id === 'string' && b.id ? b.id : uid(),
        type,
        text: typeof b.text === 'string' ? b.text : '',
      };
      if (type === 'todo') block.checked = !!b.checked;
      if (type === 'toggle') {
        block.children = normalizeBlocks(b.children);
        block.collapsed = b.collapsed !== false;
      } else if (Array.isArray(b.children) && b.children.length) {
        block.children = normalizeBlocks(b.children);
      }
      return block;
    });
}

export function convertBlock(b: Block, type: BlockType): Block {
  const next: Block = { id: b.id, type, text: type === 'divider' ? '' : b.text };
  if (type === 'todo') next.checked = b.checked ?? false;
  if (type === 'toggle') {
    next.children = b.children ?? [];
    next.collapsed = b.collapsed ?? false;
  } else if (b.children?.length) {
    next.children = b.children;
  }
  return next;
}

export function updateBlock(tree: Block[], id: string, fn: (b: Block) => Block): Block[] {
  let changed = false;
  const out = tree.map((b) => {
    if (b.id === id) {
      changed = true;
      return fn(b);
    }
    if (b.children && b.children.length) {
      const c = updateBlock(b.children, id, fn);
      if (c !== b.children) {
        changed = true;
        return { ...b, children: c };
      }
    }
    return b;
  });
  return changed ? out : tree;
}

export function removeBlock(tree: Block[], id: string): Block[] {
  const idx = tree.findIndex((b) => b.id === id);
  if (idx >= 0) {
    const removed = tree[idx];
    // Lift nested children into its place so content is not lost silently.
    const lifted = removed.children?.length ? removed.children : [];
    return [...tree.slice(0, idx), ...lifted, ...tree.slice(idx + 1)];
  }
  let changed = false;
  const out = tree.map((b) => {
    if (b.children && b.children.length) {
      const c = removeBlock(b.children, id);
      if (c !== b.children) {
        changed = true;
        return { ...b, children: c };
      }
    }
    return b;
  });
  return changed ? out : tree;
}

export function insertAfter(tree: Block[], id: string, block: Block): Block[] {
  const idx = tree.findIndex((b) => b.id === id);
  if (idx >= 0) return [...tree.slice(0, idx + 1), block, ...tree.slice(idx + 1)];
  let changed = false;
  const out = tree.map((b) => {
    if (b.children && b.children.length) {
      const c = insertAfter(b.children, id, block);
      if (c !== b.children) {
        changed = true;
        return { ...b, children: c };
      }
    }
    return b;
  });
  return changed ? out : tree;
}

export function insertFirstChild(tree: Block[], parentId: string, block: Block): Block[] {
  return updateBlock(tree, parentId, (b) => ({ ...b, children: [block, ...(b.children ?? [])] }));
}

export function findBlock(tree: Block[], id: string): Block | null {
  for (const b of tree) {
    if (b.id === id) return b;
    if (b.children) {
      const f = findBlock(b.children, id);
      if (f) return f;
    }
  }
  return null;
}

/** Visible blocks in document order; children of a toggle only when it is open. */
export function flattenVisible(tree: Block[], isOpen: (b: Block) => boolean): Block[] {
  const out: Block[] = [];
  const walk = (list: Block[]) => {
    for (const b of list) {
      out.push(b);
      if (b.children?.length && (b.type !== 'toggle' || isOpen(b))) walk(b.children);
    }
  };
  walk(tree);
  return out;
}

/** Locate a block: the list containing it, its index there, and its parent block (null at root). */
function locate(tree: Block[], id: string, parent: Block | null = null): { list: Block[]; index: number; parent: Block | null } | null {
  const index = tree.findIndex((b) => b.id === id);
  if (index >= 0) return { list: tree, index, parent };
  for (const b of tree) {
    if (b.children?.length) {
      const f = locate(b.children, id, b);
      if (f) return f;
    }
  }
  return null;
}

/** Replace the list that contains `id` (root or some block's children). */
function replaceList(tree: Block[], parentId: string | null, next: Block[]): Block[] {
  if (parentId === null) return next;
  return updateBlock(tree, parentId, (b) => ({ ...b, children: next }));
}

/**
 * Tab: nest the block as the last child of its previous sibling.
 * Returns the tree unchanged when it cannot be indented.
 */
export function indentBlock(tree: Block[], id: string): Block[] {
  const loc = locate(tree, id);
  if (!loc || loc.index === 0) return tree;
  const block = loc.list[loc.index];
  const prev = loc.list[loc.index - 1];
  if (prev.type === 'divider' || prev.type === 'code') return tree;
  const newPrev: Block = {
    ...prev,
    children: [...(prev.children ?? []), block],
    ...(prev.type === 'toggle' ? { collapsed: false } : {}),
  };
  const nextList = [...loc.list.slice(0, loc.index - 1), newPrev, ...loc.list.slice(loc.index + 1)];
  return replaceList(tree, loc.parent?.id ?? null, nextList);
}

/**
 * Shift+Tab: move the block out of its parent, right after the parent. Siblings
 * that followed it become its children (like Notion), so the visual order is kept.
 */
export function outdentBlock(tree: Block[], id: string): Block[] {
  const loc = locate(tree, id);
  if (!loc || !loc.parent) return tree;
  const parent = loc.parent;
  const block = loc.list[loc.index];
  const following = loc.list.slice(loc.index + 1);
  const moved: Block = following.length ? { ...block, children: [...(block.children ?? []), ...following] } : block;
  const parentChildren = loc.list.slice(0, loc.index);
  const newParent: Block = { ...parent, children: parentChildren };
  if (!parentChildren.length && parent.type !== 'toggle') delete newParent.children;
  const gp = locate(tree, parent.id);
  if (!gp) return tree;
  const nextList = [...gp.list.slice(0, gp.index), newParent, moved, ...gp.list.slice(gp.index + 1)];
  return replaceList(tree, gp.parent?.id ?? null, nextList);
}
