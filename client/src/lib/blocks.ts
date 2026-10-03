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

export function newBlock(type: BlockType = 'paragraph', text = ''): Block {
  const b: Block = { id: uid(), type, text };
  if (type === 'todo') b.checked = false;
  if (type === 'toggle') b.children = [];
  return b;
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
      if (type === 'toggle') block.children = normalizeBlocks(b.children);
      return block;
    });
}

export function convertBlock(b: Block, type: BlockType): Block {
  const next: Block = { id: b.id, type, text: type === 'divider' ? '' : b.text };
  if (type === 'todo') next.checked = b.checked ?? false;
  if (type === 'toggle') next.children = b.children ?? [];
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
    // Lift a toggle's children into its place so content is not lost silently.
    const lifted = removed.type === 'toggle' && removed.children?.length ? removed.children : [];
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

/** Visible blocks in document order; children of a toggle only when it is expanded. */
export function flattenVisible(tree: Block[], expanded: Set<string>): Block[] {
  const out: Block[] = [];
  const walk = (list: Block[]) => {
    for (const b of list) {
      out.push(b);
      if (b.type === 'toggle' && expanded.has(b.id) && b.children) walk(b.children);
    }
  };
  walk(tree);
  return out;
}
