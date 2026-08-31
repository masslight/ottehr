import { useAuth0 } from '@auth0/auth0-react';
import { useEffect, useRef } from 'react';

export const useAwaitAuth0 = (): Promise<void> => {
  const { isLoading } = useAuth0();
  const awaitAuth0LoadRef = useRef<Promise<void> | null>(null);
  const auth0AwaitResolverRef = useRef<(() => void) | null>(null);

  if (!awaitAuth0LoadRef.current) {
    awaitAuth0LoadRef.current = new Promise((resolve) => {
      auth0AwaitResolverRef.current = resolve;
    });
  }

  useEffect(() => {
    if (isLoading === false && auth0AwaitResolverRef.current) {
      auth0AwaitResolverRef.current();
      auth0AwaitResolverRef.current = null;
    }
  }, [isLoading]);

  return awaitAuth0LoadRef.current;
};
