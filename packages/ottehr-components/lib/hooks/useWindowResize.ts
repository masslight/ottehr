import { useState, useLayoutEffect } from 'react';

export const useWindowResize = (): [number, number] => {
  const [size, setSize] = useState<[number, number]>([0, 0]);

  useLayoutEffect(() => {
    function updateSize(): void {
      setSize([window.innerWidth, window.innerHeight]);
    }

    window.addEventListener('resize', updateSize);
    updateSize();

    return () => window.removeEventListener('resize', updateSize);
  }, []);

  return size;
};
