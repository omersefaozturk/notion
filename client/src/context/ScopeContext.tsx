import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';
import type { Scope } from '../api';

const KEY = 'ortakplan.scope';

function readScope(): Scope {
  try {
    const v = localStorage.getItem(KEY);
    if (v === 'mine' || v === 'partner' || v === 'merged') return v;
  } catch {
    /* ignore */
  }
  return 'merged';
}

interface ScopeContextValue {
  scope: Scope;
  setScope: (s: Scope) => void;
}

const ScopeContext = createContext<ScopeContextValue | null>(null);

export function ScopeProvider({ children }: { children: ReactNode }) {
  const [scope, setScopeState] = useState<Scope>(readScope);
  const setScope = useCallback((s: Scope) => {
    setScopeState(s);
    try {
      localStorage.setItem(KEY, s);
    } catch {
      /* ignore */
    }
  }, []);
  return <ScopeContext.Provider value={{ scope, setScope }}>{children}</ScopeContext.Provider>;
}

export function useScope(): ScopeContextValue {
  const ctx = useContext(ScopeContext);
  if (!ctx) throw new Error('useScope must be used within ScopeProvider');
  return ctx;
}

export const SCOPE_LABELS: Record<Scope, string> = {
  mine: 'Benim',
  partner: 'Eşim',
  merged: 'Ortak',
};
