import { useCallback, useRef } from 'react';

export function useDebounce(timeout = 400): {
  debounce: (func: () => void, key?: string) => void;
  clear: (key?: string) => void;
} {
  const timeouts = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const debounce = useCallback(
    (func: () => void, key = 'default'): void => {
      const existing = timeouts.current.get(key);
      if (existing) clearTimeout(existing);
      timeouts.current.set(
        key,
        setTimeout(() => {
          func();
          timeouts.current.delete(key);
        }, timeout)
      );
    },
    [timeout]
  );

  const clear = useCallback((key?: string): void => {
    if (key) {
      const id = timeouts.current.get(key);
      if (id) {
        clearTimeout(id);
        timeouts.current.delete(key);
      }
    } else {
      timeouts.current.forEach((id) => clearTimeout(id));
      timeouts.current.clear();
    }
  }, []);

  return { debounce, clear };
}
