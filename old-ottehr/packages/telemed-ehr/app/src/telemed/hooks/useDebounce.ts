import { useRef } from 'react';

export const useDebounce = (timeout = 500): { debounce: (func: () => void) => void; clear: () => void } => {
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>();

  const debounce = (func: () => void): void => {
    if (timeoutRef.current) {
      clear();
    }
    timeoutRef.current = setTimeout(() => {
      func();
    }, timeout);
  };

  const clear = (): void => {
    clearTimeout(timeoutRef.current);
    timeoutRef.current = undefined;
  };

  return { debounce, clear };
};
