import { useContext, useEffect } from 'react';
import { UNSAFE_NavigationContext } from 'react-router-dom';

// Helper to normalize React Router's "To" into a string path
const toPath = (to: any): string => {
  if (typeof to === 'string') return to;
  if (typeof to?.pathname === 'string') return to.pathname;
  return '';
};

export function useBlocker(blocker: (tx: any) => void, when = true): void {
  const navigator = useContext(UNSAFE_NavigationContext).navigator;

  useEffect(() => {
    if (!when) return;

    const push = navigator.push;
    const replace = navigator.replace;
    const go = navigator.go;

    navigator.push = (...args: Parameters<typeof push>) => {
      const nextUrl = toPath(args[0]);
      if (nextUrl.includes('/patient/')) {
        push(...args);
      } else {
        blocker({ retry: () => push(...args), location: { pathname: nextUrl } });
      }
    };

    navigator.replace = (...args: Parameters<typeof replace>) => {
      const nextUrl = toPath(args[0]);
      if (nextUrl.includes('/patient/')) {
        replace(...args);
      } else {
        blocker({ retry: () => replace(...args), location: { pathname: nextUrl } });
      }
    };

    navigator.go = (delta: number) => {
      blocker({ retry: () => go(delta) });
    };

    const handlePopState = (): void => {
      go(1);
      blocker({
        retry: () => {
          replace('/patients');
        },
      });
    };

    const handleBeforeUnload = (e: BeforeUnloadEvent): void => {
      e.preventDefault();
      e.returnValue = '';
    };

    const handleVisibilityChange = (): void => {
      if (document.visibilityState === 'hidden') {
        // Tab switch
        blocker({
          retry: () => {
            // no-op, they just switched tabs
          },
        });
      }
    };

    window.addEventListener('popstate', handlePopState);
    window.addEventListener('beforeunload', handleBeforeUnload);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      navigator.push = push;
      navigator.replace = replace;
      navigator.go = go;
      window.removeEventListener('beforeunload', handleBeforeUnload);
      window.removeEventListener('popstate', handlePopState);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [navigator, blocker, when]);
}
