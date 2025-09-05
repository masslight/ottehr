import { useContext, useEffect } from 'react';
import { UNSAFE_NavigationContext } from 'react-router-dom';

export function useBlocker(blocker: (tx: any) => void, when = true): void {
  const navigator = useContext(UNSAFE_NavigationContext).navigator;

  useEffect((): (() => void) => {
    const push = navigator.push;
    const replace = navigator.replace;
    const go = navigator.go;

    navigator.push = (...args: Parameters<typeof push>): void => {
      blocker({ retry: () => push(...args) });
    };

    navigator.replace = (...args: Parameters<typeof replace>): void => {
      blocker({ retry: () => replace(...args) });
    };

    navigator.go = (delta: number): void => {
      blocker({ retry: () => go(delta) });
    };

    const handlePopState = (): void => {
      go(1);
      blocker({
        retry: (): void => {
          console.log('hi');
          replace('/patients');
        },
      });
    };

    history.pushState(null, '', window.location.href);
    window.addEventListener('popstate', handlePopState);

    return (): void => {
      navigator.push = push;
      navigator.replace = replace;
      navigator.go = go;
      window.removeEventListener('popstate', handlePopState);
    };
  }, [navigator, blocker, when]);
}
