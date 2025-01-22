import { useCallback } from 'react';
import { useLocation } from 'react-router-dom';

export const usePreserveQueryParams = (): ((path: string) => string) => {
  const { search } = useLocation();
  return useCallback(
    (path: string) => {
      return `${path}${search}`;
    },
    [search]
  );
};
