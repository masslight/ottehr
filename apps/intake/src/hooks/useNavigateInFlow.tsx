import { useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

export const useNavigateInFlow = (): ((path: string) => void) => {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  return useCallback(
    (nextStop: string) => {
      const toReplace = pathname.split('/').pop();
      if (!toReplace) {
        navigate(nextStop);
      } else {
        navigate(pathname.replace(toReplace, nextStop));
      }
    },
    [navigate, pathname]
  );
};
