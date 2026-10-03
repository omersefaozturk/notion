import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';

/** Lightweight signal so the sidebar page tree can refresh after page mutations. */
interface PagesContextValue {
  version: number;
  bump: () => void;
}

const PagesContext = createContext<PagesContextValue | null>(null);

export function PagesProvider({ children }: { children: ReactNode }) {
  const [version, setVersion] = useState(0);
  const bump = useCallback(() => setVersion((v) => v + 1), []);
  return <PagesContext.Provider value={{ version, bump }}>{children}</PagesContext.Provider>;
}

export function usePagesSignal(): PagesContextValue {
  const ctx = useContext(PagesContext);
  if (!ctx) throw new Error('usePagesSignal must be used within PagesProvider');
  return ctx;
}
