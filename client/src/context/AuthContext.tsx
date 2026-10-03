import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { authApi, getToken, setToken, setUnauthorizedHandler, type Household, type User } from '../api';

interface RegisterInput {
  name: string;
  email: string;
  password: string;
  initial?: string;
  color?: string;
  inviteCode?: string;
}

interface AuthContextValue {
  user: User | null;
  household: Household | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (input: RegisterInput) => Promise<void>;
  logout: () => void;
  refresh: () => Promise<void>;
  setUser: (u: User) => void;
  setHousehold: (h: Household) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [household, setHousehold] = useState<Household | null>(null);
  const [loading, setLoading] = useState<boolean>(() => !!getToken());
  const navigate = useNavigate();

  const refresh = useCallback(async () => {
    if (!getToken()) {
      setUser(null);
      setHousehold(null);
      setLoading(false);
      return;
    }
    try {
      const me = await authApi.me();
      setUser(me.user);
      setHousehold(me.household);
    } catch {
      // 401 is handled by the unauthorized handler; other errors leave user unset
    } finally {
      setLoading(false);
    }
  }, []);

  const logout = useCallback(() => {
    setToken(null);
    setUser(null);
    setHousehold(null);
    navigate('/login', { replace: true });
  }, [navigate]);

  useEffect(() => {
    setUnauthorizedHandler(() => {
      setUser(null);
      setHousehold(null);
      navigate('/login', { replace: true });
    });
    return () => setUnauthorizedHandler(null);
  }, [navigate]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const login = useCallback(
    async (email: string, password: string) => {
      const res = await authApi.login({ email, password });
      setToken(res.token);
      setUser(res.user);
      await refresh();
    },
    [refresh],
  );

  const register = useCallback(
    async (input: RegisterInput) => {
      const res = await authApi.register(input);
      setToken(res.token);
      setUser(res.user);
      await refresh();
    },
    [refresh],
  );

  const value = useMemo<AuthContextValue>(
    () => ({ user, household, loading, login, register, logout, refresh, setUser, setHousehold }),
    [user, household, loading, login, register, logout, refresh],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

/** Authenticated user — only use inside protected routes. */
export function useUser(): User {
  const { user } = useAuth();
  if (!user) throw new Error('No authenticated user');
  return user;
}
