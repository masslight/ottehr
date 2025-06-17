import { useMemo } from 'react';

export function useCookie(name: string): string | null {
  const cookieStr = document.cookie;
  return useMemo(() => {
    const cookies = cookieStr.split(';');

    for (const cookie of cookies) {
      const [cookieName, cookieValue] = cookie.split('=');
      if (cookieName.trim() === name) {
        return cookieValue;
      }
    }
    return null;
  }, [name, cookieStr]);
}
