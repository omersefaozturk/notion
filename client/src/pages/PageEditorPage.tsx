import { useCallback, useEffect, useLayoutEffect, useRef, useState, type Dispatch, type SetStateAction } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ApiError, pagesApi, type Block, type Page, type Visibility } from '../api';
import { BlockEditor } from '../components/editor/BlockEditor';
import { EmojiPicker } from '../components/EmojiPicker';
import { Modal } from '../components/Modal';
import { OwnerBadge } from '../components/OwnerBadge';
import { Button, ErrorBox, Loading, PrivateTag } from '../components/ui';
import { VisibilityToggle } from '../components/VisibilityToggle';
import { useUser } from '../context/AuthContext';
import { usePagesSignal } from '../context/PagesContext';
import { useScope } from '../context/ScopeContext';
import { normalizeBlocks } from '../lib/blocks';
import { fmt, PERIOD_LABELS, periodLabel } from '../lib/dates';
import { useAsync } from '../lib/useAsync';
import { errorMessage } from '../lib/util';

type SaveState = 'saved' | 'dirty' | 'saving' | 'error';
const SAVE_DELAY = 700;

export function PageEditorPage() {
  const { id } = useParams();
  const pageId = Number(id);
  if (!Number.isInteger(pageId) || pageId <= 0) {
    return <div className="p-8 text-sm text-neutral-500">Geçersiz sayfa.</div>;
  }
  return <PageEditor key={pageId} pageId={pageId} />;
}

function PageEditor({ pageId }: { pageId: number }) {
  const user = useUser();
  const { scope } = useScope();
  const { version, bump } = usePagesSignal();
  const navigate = useNavigate();

  const [page, setPage] = useState<Page | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [icon, setIcon] = useState<string | null>(null);
  const [visibility, setVisibility] = useState<Visibility>('shared');
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [saveState, setSaveState] = useState<SaveState>('saved');
  const [saveError, setSaveError] = useState<string | null>(null);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const latest = useRef({ title, icon, visibility, blocks });
  latest.current = { title, icon, visibility, blocks };
  const lastSavedMeta = useRef({ title: '', icon: null as string | null, visibility: 'shared' as Visibility });
  const timer = useRef<number | null>(null);
  const dirty = useRef(false);
  const titleRef = useRef<HTMLTextAreaElement>(null);

  // Load
  useEffect(() => {
    let cancelled = false;
    pagesApi
      .get(pageId)
      .then((p) => {
        if (cancelled) return;
        setPage(p);
        setTitle(p.title ?? '');
        setIcon(p.icon ?? null);
        setVisibility(p.visibility);
        setBlocks(normalizeBlocks(p.content));
        lastSavedMeta.current = { title: p.title ?? '', icon: p.icon ?? null, visibility: p.visibility };
      })
      .catch((e) => {
        if (!cancelled) setLoadError(e instanceof ApiError && e.status === 404 ? 'Sayfa bulunamadı ya da erişimin yok.' : errorMessage(e));
      });
    return () => {
      cancelled = true;
    };
  }, [pageId]);

  const readOnly = !page || page.owner.id !== user.id;

  const save = useCallback(async () => {
    if (timer.current) {
      window.clearTimeout(timer.current);
      timer.current = null;
    }
    if (!dirty.current) return;
    dirty.current = false;
    const snap = latest.current;
    setSaveState('saving');
    try {
      await pagesApi.update(pageId, { title: snap.title, icon: snap.icon, visibility: snap.visibility, content: snap.blocks });
      const meta = lastSavedMeta.current;
      if (meta.title !== snap.title || meta.icon !== snap.icon || meta.visibility !== snap.visibility) {
        lastSavedMeta.current = { title: snap.title, icon: snap.icon, visibility: snap.visibility };
        bump();
      }
      setSaveError(null);
      setSaveState(dirty.current ? 'dirty' : 'saved');
    } catch (e) {
      dirty.current = true;
      setSaveError(errorMessage(e));
      setSaveState('error');
    }
  }, [pageId, bump]);

  const schedule = useCallback(() => {
    dirty.current = true;
    setSaveState('dirty');
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => void save(), SAVE_DELAY);
  }, [save]);

  // Flush pending changes when leaving the page.
  useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (dirty.current) {
        void save();
        e.preventDefault();
      }
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', onBeforeUnload);
      if (dirty.current) void save();
    };
  }, [save]);

  const setBlocksAndSave: Dispatch<SetStateAction<Block[]>> = useCallback(
    (u) => {
      setBlocks(u);
      schedule();
    },
    [schedule],
  );

  useLayoutEffect(() => {
    const el = titleRef.current;
    if (!el) return;
    el.style.height = '0px';
    el.style.height = `${el.scrollHeight}px`;
  }, [title, page]);

  // Sub-pages
  const children = useAsync(() => pagesApi.list({ scope, parentId: pageId }), [scope, pageId, version]);

  async function addSubPage() {
    try {
      await save();
      const p = await pagesApi.create({ title: '', parentId: pageId });
      bump();
      navigate(`/pages/${p.id}`);
    } catch (e) {
      setSaveError(errorMessage(e));
    }
  }

  async function handleDelete() {
    setDeleting(true);
    try {
      dirty.current = false;
      await pagesApi.remove(pageId);
      bump();
      navigate(page?.parentId ? `/pages/${page.parentId}` : page?.period ? '/plans' : '/', { replace: true });
    } catch (e) {
      setSaveError(errorMessage(e));
      setDeleting(false);
      setConfirmDelete(false);
    }
  }

  if (loadError) {
    return (
      <div className="mx-auto max-w-3xl px-6 py-10">
        <ErrorBox message={loadError} />
        <Link to="/" className="mt-4 inline-block text-sm text-neutral-500 underline">
          Ana sayfaya dön
        </Link>
      </div>
    );
  }
  if (!page) {
    return (
      <div className="mx-auto max-w-3xl px-6 py-10">
        <Loading />
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-3xl px-4 pb-24 pt-4 sm:px-10">
      {/* Top row: breadcrumbs + status */}
      <div className="mb-6 flex flex-wrap items-center gap-2 text-sm text-neutral-500">
        <nav className="flex min-w-0 flex-1 flex-wrap items-center gap-1" aria-label="Sayfa yolu">
          {page.period && (
            <>
              <Link to="/plans" className="rounded px-1 hover:bg-neutral-100">
                Planlar
              </Link>
              <span className="text-neutral-300">/</span>
            </>
          )}
          {page.breadcrumbs.map((b) => (
            <span key={b.id} className="flex items-center gap-1">
              <Link to={`/pages/${b.id}`} className="flex max-w-[180px] items-center gap-1 truncate rounded px-1 hover:bg-neutral-100">
                <span>{b.icon || '📄'}</span>
                <span className="truncate">{b.title || 'Adsız'}</span>
              </Link>
              <span className="text-neutral-300">/</span>
            </span>
          ))}
          <span className="flex max-w-[220px] items-center gap-1 truncate px-1 text-neutral-800">
            <span>{icon || '📄'}</span>
            <span className="truncate">{title || 'Adsız'}</span>
          </span>
        </nav>
        <span className="text-xs text-neutral-400" aria-live="polite">
          {readOnly
            ? 'Salt okunur'
            : saveState === 'saving'
              ? 'Kaydediliyor…'
              : saveState === 'dirty'
                ? 'Düzenleniyor…'
                : saveState === 'error'
                  ? 'Kaydedilemedi'
                  : 'Kaydedildi'}
        </span>
        {!readOnly && (
          <Button size="sm" variant="ghost" className="text-red-600" onClick={() => setConfirmDelete(true)}>
            Sil
          </Button>
        )}
      </div>

      {saveError && (
        <div className="mb-4">
          <ErrorBox message={saveError} onRetry={readOnly ? undefined : () => { dirty.current = true; void save(); }} />
        </div>
      )}

      {/* Icon */}
      <div className="relative mb-2 pl-8">
        {icon ? (
          <button
            type="button"
            disabled={readOnly}
            onClick={() => setEmojiOpen((o) => !o)}
            className="rounded-lg p-1 text-6xl leading-none hover:bg-neutral-100 disabled:hover:bg-transparent"
            title="Simgeyi değiştir"
          >
            {icon}
          </button>
        ) : (
          !readOnly && (
            <button type="button" onClick={() => setEmojiOpen(true)} className="rounded px-1.5 py-1 text-sm text-neutral-400 hover:bg-neutral-100 hover:text-neutral-600">
              ☺ Simge ekle
            </button>
          )
        )}
        {emojiOpen && !readOnly && (
          <EmojiPicker
            onClose={() => setEmojiOpen(false)}
            onSelect={(e) => {
              setIcon(e);
              setEmojiOpen(false);
              schedule();
            }}
            onRemove={
              icon
                ? () => {
                    setIcon(null);
                    setEmojiOpen(false);
                    schedule();
                  }
                : undefined
            }
          />
        )}
      </div>

      {/* Title */}
      <div className="pl-8">
        <textarea
          ref={titleRef}
          rows={1}
          value={title}
          readOnly={readOnly}
          placeholder="Adsız"
          onChange={(e) => {
            setTitle(e.target.value.replace(/\n/g, ''));
            schedule();
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') e.preventDefault();
          }}
          className="block w-full resize-none overflow-hidden bg-transparent text-4xl font-bold leading-tight text-neutral-900 outline-none placeholder:text-neutral-300"
        />
        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-neutral-500">
          <span className="flex items-center gap-1.5">
            <OwnerBadge owner={page.owner} size="sm" /> {page.owner.name}
          </span>
          {page.period && page.periodStart && (
            <span className="rounded bg-violet-50 px-2 py-0.5 text-xs text-violet-700">
              {PERIOD_LABELS[page.period]} plan · {periodLabel(page.period, page.periodStart)}
            </span>
          )}
          {readOnly ? (
            <span>{visibility === 'private' ? <><PrivateTag /> Özel</> : 'Ortak'}</span>
          ) : (
            <VisibilityToggle
              value={visibility}
              onChange={(v) => {
                setVisibility(v);
                schedule();
              }}
            />
          )}
          <span className="text-xs text-neutral-400">Son güncelleme {fmt(new Date(page.updatedAt), 'd MMM yyyy HH:mm')}</span>
        </div>
        {readOnly && (
          <p className="mt-3 rounded-md bg-neutral-50 px-3 py-2 text-xs text-neutral-500">
            Bu sayfa {page.owner.name} tarafından oluşturuldu. Yalnızca sahibi düzenleyebilir.
          </p>
        )}
      </div>

      <div className="mt-6">
        <BlockEditor blocks={blocks} setBlocks={setBlocksAndSave} readOnly={readOnly} />
      </div>

      {/* Sub-pages */}
      <div className="mt-8 border-t border-neutral-100 pl-8 pt-4">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-neutral-700">Alt sayfalar</h2>
          <Button size="sm" variant="ghost" onClick={addSubPage}>
            + Alt sayfa ekle
          </Button>
        </div>
        {children.data && children.data.length === 0 && <div className="text-sm text-neutral-400">Alt sayfa yok.</div>}
        <div className="space-y-0.5">
          {children.data?.map((c) => (
            <Link key={c.id} to={`/pages/${c.id}`} className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-neutral-50">
              <span>{c.icon || '📄'}</span>
              <span className="min-w-0 flex-1 truncate border-b border-neutral-200 text-neutral-800">{c.title || 'Adsız'}</span>
              {c.visibility === 'private' && <PrivateTag />}
              <OwnerBadge owner={c.owner} size="sm" />
            </Link>
          ))}
        </div>
      </div>

      <Modal
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        title="Sayfayı sil"
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirmDelete(false)}>
              Vazgeç
            </Button>
            <Button variant="danger" onClick={handleDelete} disabled={deleting}>
              {deleting ? 'Siliniyor…' : 'Sil'}
            </Button>
          </>
        }
      >
        <p className="text-sm text-neutral-600">
          “{title || 'Adsız'}” ve tüm alt sayfaları kalıcı olarak silinecek. Emin misin?
        </p>
      </Modal>
    </div>
  );
}
