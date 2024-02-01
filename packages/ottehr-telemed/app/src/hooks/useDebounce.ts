// https://designtechworld.medium.com/create-a-custom-debounce-hook-in-react-114f3f245260
import { useEffect, useRef } from 'react';

export const useDebounce = (callback: (...args: any[]) => any, delay: number): ((...args: any[]) => any) => {
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    // Cleanup the previous timeout on re-render
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  const debouncedCallback = (...args: any[]): void => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    timeoutRef.current = setTimeout(() => {
      callback(...args);
    }, delay);
  };

  return debouncedCallback;
};
