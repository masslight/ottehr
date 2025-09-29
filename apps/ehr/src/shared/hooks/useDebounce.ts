import { useRef } from 'react';

export const useDebounce = (
  timeout = 500
): {
  debounce: (func: () => void, key?: string) => void;
  clear: (key?: string) => void;
} => {
  const timeoutsRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const debounce = (func: () => void, key: string = 'default'): void => {
    if (timeoutsRef.current.has(key)) {
      clearTimeout(timeoutsRef.current.get(key));
    }

    const timeoutId = setTimeout(() => {
      func();
      timeoutsRef.current.delete(key);
    }, timeout);

    timeoutsRef.current.set(key, timeoutId);
  };

  const clear = (key?: string): void => {
    if (key) {
      const timeoutId = timeoutsRef.current.get(key);
      if (timeoutId) {
        clearTimeout(timeoutId);
        timeoutsRef.current.delete(key);
      }
    } else {
      timeoutsRef.current.forEach((timeoutId) => clearTimeout(timeoutId));
      timeoutsRef.current.clear();
    }
  };

  return { debounce, clear };
};
