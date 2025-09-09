import { useContext, useEffect } from 'react';
import { UNSAFE_NavigationContext } from 'react-router-dom';

export function useBlocker(blocker: (tx: any) => void, when = true): void {
  const navigator = useContext(UNSAFE_NavigationContext).navigator;

  useEffect(() => {
    if (!when) return;

    const push = navigator.push;
    const replace = navigator.replace;
    const go = navigator.go;

    navigator.push = (...args: Parameters<typeof push>) => {
      blocker({ retry: () => push(...args) });
    };

    navigator.replace = (...args: Parameters<typeof replace>) => {
      blocker({ retry: () => replace(...args) });
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
      blocker({
        retry: () => {
          window.removeEventListener('beforeunload', handleBeforeUnload);
          window.close();
        },
      });
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

    history.pushState(null, '', window.location.href);
    window.addEventListener('popstate', handlePopState);
    window.addEventListener('beforeunload', handleBeforeUnload);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      navigator.push = push;
      navigator.replace = replace;
      navigator.go = go;
      window.removeEventListener('popstate', handlePopState);
      window.removeEventListener('beforeunload', handleBeforeUnload);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [navigator, blocker, when]);
}
