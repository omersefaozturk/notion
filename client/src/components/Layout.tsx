import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import type { Scope } from '../api';
import { useAuth, useUser } from '../context/AuthContext';
import { SCOPE_LABELS, useScope } from '../context/ScopeContext';
import { useTheme } from '../lib/theme';
import { cx } from '../lib/util';
import { OwnerBadge } from './OwnerBadge';
import { PageTree } from './PageTree';
import { SegmentedControl } from './ui';

const NAV = [
  { to: '/', label: 'Bugün', icon: '☀️', end: true },
  { to: '/calendar', label: 'Takvim', icon: '📅' },
  { to: '/board', label: 'Pano', icon: '🗂️' },
  { to: '/goals', label: 'Hedefler', icon: '🎯' },
  { to: '/plans', label: 'Planlar', icon: '🗒️' },
];

function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const user = useUser();
  const { household, logout } = useAuth();
  const linkCls = ({ isActive }: { isActive: boolean }) =>
    cx(
      'flex items-center gap-2 rounded-md px-2 py-1.5 text-sm',
      isActive ? 'bg-neutral-200/70 font-medium text-neutral-900' : 'text-neutral-600 hover:bg-neutral-200/50',
    );
  return (
    <div className="flex h-full flex-col">
      <div className="px-3 pb-2 pt-4">
        <div className="flex items-center gap-2 px-2 text-sm font-semibold text-neutral-900">
          <span className="text-lg">📒</span> Ortak Plan
        </div>
        {household && <div className="mt-0.5 truncate px-2 pl-9 text-xs text-neutral-400">{household.name}</div>}
      </div>
      <nav className="space-y-0.5 px-3">
        {NAV.map((n) => (
          <NavLink key={n.to} to={n.to} end={n.end} className={linkCls} onClick={onNavigate}>
            <span className="w-5 text-center">{n.icon}</span>
            {n.label}
          </NavLink>
        ))}
      </nav>
      <div className="mt-4 min-h-0 flex-1 overflow-y-auto px-3">
        <PageTree onNavigate={onNavigate} />
      </div>
      <div className="space-y-0.5 border-t border-neutral-200 px-3 py-2">
        <NavLink to="/settings" className={linkCls} onClick={onNavigate}>
          <span className="w-5 text-center">⚙️</span>
          Ayarlar
        </NavLink>
        <div className="flex items-center gap-2 rounded-md px-2 py-1.5">
          <OwnerBadge owner={user} size="md" />
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-medium text-neutral-800">{user.name}</div>
            <div className="truncate text-xs text-neutral-400">{user.email}</div>
          </div>
          <button type="button" onClick={logout} title="Çıkış yap" className="rounded px-1.5 py-1 text-xs text-neutral-500 hover:bg-neutral-200 hover:text-neutral-800">
            Çıkış
          </button>
        </div>
      </div>
    </div>
  );
}

export function Layout() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const { scope, setScope } = useScope();
  const [theme, toggleTheme] = useTheme();
  const location = useLocation();

  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  return (
    <div className="flex min-h-screen bg-white text-neutral-900">
      {/* Desktop sidebar */}
      <aside className="hidden w-60 shrink-0 border-r border-neutral-200 bg-neutral-50 md:block">
        <div className="sticky top-0 h-screen">
          <Sidebar />
        </div>
      </aside>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div className="absolute inset-0 bg-black/30" onClick={() => setMobileOpen(false)} />
          <aside className="absolute inset-y-0 left-0 w-64 bg-neutral-50 shadow-xl">
            <Sidebar onNavigate={() => setMobileOpen(false)} />
          </aside>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-12 items-center gap-2 border-b border-neutral-100 bg-white/90 px-3 backdrop-blur sm:px-4">
          <button
            type="button"
            className="rounded p-1.5 text-neutral-600 hover:bg-neutral-100 md:hidden"
            onClick={() => setMobileOpen(true)}
            aria-label="Menüyü aç"
          >
            ☰
          </button>
          <span className="text-sm font-semibold md:hidden">Ortak Plan</span>
          <div className="ml-auto flex items-center gap-2">
            <button
              type="button"
              onClick={toggleTheme}
              aria-label={theme === 'dark' ? 'Aydınlık moda geç' : 'Karanlık moda geç'}
              title={theme === 'dark' ? 'Aydınlık mod' : 'Karanlık mod'}
              className="rounded p-1.5 text-sm text-neutral-500 hover:bg-neutral-100"
            >
              {theme === 'dark' ? '☀️' : '🌙'}
            </button>
            <span className="hidden text-xs text-neutral-400 sm:inline">Görünüm:</span>
            <SegmentedControl<Scope>
              size="sm"
              value={scope}
              onChange={setScope}
              options={(['mine', 'partner', 'merged'] as Scope[]).map((s) => ({ value: s, label: SCOPE_LABELS[s] }))}
            />
          </div>
        </header>
        <main className="min-w-0 flex-1">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

export function PageContainer({ children, wide }: { children: React.ReactNode; wide?: boolean }) {
  return <div className={cx('mx-auto w-full px-4 py-6 sm:px-8', wide ? 'max-w-7xl' : 'max-w-4xl')}>{children}</div>;
}

export function PageHeader({ title, icon, actions, subtitle }: { title: string; icon?: string; actions?: React.ReactNode; subtitle?: React.ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold text-neutral-900 sm:text-3xl">
          {icon && <span>{icon}</span>}
          {title}
        </h1>
        {subtitle && <div className="mt-1 text-sm text-neutral-500">{subtitle}</div>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}
