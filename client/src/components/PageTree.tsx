import { useCallback, useEffect, useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { pagesApi, type PageSummary } from '../api';
import { usePagesSignal } from '../context/PagesContext';
import { useScope } from '../context/ScopeContext';
import { cx } from '../lib/util';
import { OwnerBadge } from './OwnerBadge';

function TreeNode({ page, depth, onNavigate }: { page: PageSummary; depth: number; onNavigate?: () => void }) {
  const [open, setOpen] = useState(false);
  const [children, setChildren] = useState<PageSummary[] | null>(null);
  const { scope } = useScope();
  const { version, bump } = usePagesSignal();
  const navigate = useNavigate();

  const loadChildren = useCallback(async () => {
    try {
      setChildren(await pagesApi.list({ scope, parentId: page.id }));
    } catch {
      setChildren([]);
    }
  }, [scope, page.id]);

  useEffect(() => {
    if (open) void loadChildren();
  }, [open, loadChildren, version]);

  async function addChild(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    try {
      const p = await pagesApi.create({ title: '', parentId: page.id });
      setOpen(true);
      bump();
      navigate(`/pages/${p.id}`);
      onNavigate?.();
    } catch {
      /* ignore */
    }
  }

  const expandable = page.hasChildren || (children && children.length > 0);

  return (
    <div>
      <NavLink
        to={`/pages/${page.id}`}
        onClick={onNavigate}
        className={({ isActive }) =>
          cx(
            'group flex items-center gap-1 rounded-md py-1 pr-1 text-sm',
            isActive ? 'bg-neutral-200/70 font-medium text-neutral-900' : 'text-neutral-600 hover:bg-neutral-200/50',
          )
        }
        style={{ paddingLeft: 4 + depth * 12 }}
      >
        <button
          type="button"
          aria-label={open ? 'Daralt' : 'Genişlet'}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setOpen((o) => !o);
          }}
          className={cx('flex h-5 w-5 shrink-0 items-center justify-center rounded text-[10px] text-neutral-400 hover:bg-neutral-300/60', !expandable && 'opacity-40')}
        >
          <span className={cx('transition-transform', open && 'rotate-90')}>▶</span>
        </button>
        <span className="shrink-0">{page.icon || '📄'}</span>
        <span className="min-w-0 flex-1 truncate">{page.title || 'Adsız'}</span>
        <OwnerBadge owner={page.owner} size="xs" />
        <button
          type="button"
          onClick={addChild}
          title="Alt sayfa ekle"
          className="hidden h-5 w-5 shrink-0 items-center justify-center rounded text-neutral-500 hover:bg-neutral-300/60 group-hover:flex"
        >
          +
        </button>
      </NavLink>
      {open && (
        <div>
          {children === null ? null : children.length === 0 ? (
            <div className="py-1 text-xs text-neutral-400" style={{ paddingLeft: 28 + depth * 12 }}>
              Alt sayfa yok
            </div>
          ) : (
            children.map((c) => <TreeNode key={c.id} page={c} depth={depth + 1} onNavigate={onNavigate} />)
          )}
        </div>
      )}
    </div>
  );
}

export function PageTree({ onNavigate }: { onNavigate?: () => void }) {
  const { scope } = useScope();
  const { version, bump } = usePagesSignal();
  const [pages, setPages] = useState<PageSummary[] | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    let cancelled = false;
    pagesApi
      .list({ scope, parentId: 'root' })
      .then((list) => {
        // Plans have their own screen; keep the tree for regular pages.
        if (!cancelled) setPages(list.filter((p) => !p.period));
      })
      .catch(() => {
        if (!cancelled) setPages([]);
      });
    return () => {
      cancelled = true;
    };
  }, [scope, version]);

  async function newPage() {
    try {
      const p = await pagesApi.create({ title: '' });
      bump();
      navigate(`/pages/${p.id}`);
      onNavigate?.();
    } catch {
      /* ignore */
    }
  }

  return (
    <div>
      <div className="mb-1 px-2 text-xs font-semibold uppercase tracking-wide text-neutral-400">Sayfalar</div>
      {pages?.map((p) => <TreeNode key={p.id} page={p} depth={0} onNavigate={onNavigate} />)}
      {pages && pages.length === 0 && <div className="px-2 py-1 text-xs text-neutral-400">Henüz sayfa yok</div>}
      <button type="button" onClick={newPage} className="mt-1 flex w-full items-center gap-2 rounded-md px-2 py-1 text-sm text-neutral-500 hover:bg-neutral-200/50">
        <span className="w-5 text-center">+</span> Yeni sayfa
      </button>
    </div>
  );
}
