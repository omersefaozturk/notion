import { useCallback, useEffect, useRef, useState } from 'react';
import { errorMessage } from './util';

/**
 * Loads data with `fn` whenever `deps` change. Returns data, loading, error and
 * a `reload` function. Stale responses are ignored.
 */
export function useAsync<T>(fn: () => Promise<T>, deps: unknown[]) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const reqId = useRef(0);
  const fnRef = useRef(fn);
  fnRef.current = fn;

  const reload = useCallback(async () => {
    const id = ++reqId.current;
    setLoading(true);
    try {
      const result = await fnRef.current();
      if (id === reqId.current) {
        setData(result);
        setError(null);
      }
    } catch (e) {
      if (id === reqId.current) setError(errorMessage(e));
    } finally {
      if (id === reqId.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return { data, setData, loading, error, reload };
}
