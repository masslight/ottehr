import { useAuth0 } from '@auth0/auth0-react';
import Oystehr from '@oystehr/sdk';
import { createContext, FC, PropsWithChildren, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { checkTokenIsValid } from 'src/api/tokenUtils';
import { useAwaitAuth0 } from 'src/hooks/useAwaitAuth0';

export const useClient = ({ tokenless }: { tokenless: boolean }): Oystehr | null => {
  const context = useContext(IntakeClientsContext);

  if (context === undefined) {
    throw new Error('useIntakeClients hook must be used within a IntakeClientsProvider');
  }

  const { clientWithToken, clientTokenless } = context;

  return tokenless ? clientTokenless : clientWithToken;
};

type IntakeClientsContext = {
  clientWithToken: Oystehr | null;
  clientTokenless: Oystehr | null;
};

export const IntakeClientsContext = createContext<IntakeClientsContext>({
  clientWithToken: null,
  clientTokenless: null,
});

export const IntakeClientsProvider: FC<PropsWithChildren> = ({ children }) => {
  const [clientWithToken, setClientWithToken] = useState<Oystehr | null>(null);
  const [clientTokenless, setClientTokenless] = useState<Oystehr | null>(null);
  const { isAuthenticated, getAccessTokenSilently, logout } = useAuth0();
  const auth0Loaded = useAwaitAuth0();
  const [searchParams, _] = useSearchParams();
  const urlTokenFromUrl = searchParams.get('token') ?? undefined;
  const refreshTokenPromiseRef = useRef<Promise<string | undefined> | null>(null);
  const activeTokenRef = useRef<string | undefined>(undefined);

  // If user is authenticated, Auth0 token is used;
  // if not authenticated but URL token is present, URL token is used;
  // otherwise return undefined
  const tryGetToken = useCallback(async (): Promise<string | undefined> => {
    await auth0Loaded; // we need to be synced with auth0 state before we try to get the token;

    const token = await (async () => {
      const shouldUseAuth0Token = Boolean(isAuthenticated);
      const shouldUseUrlToken = Boolean(!isAuthenticated && urlTokenFromUrl);

      if (shouldUseAuth0Token) {
        return await (async () => {
          if (!refreshTokenPromiseRef.current) {
            // prevent multiple calls to getAccessTokenSilently from different places if the token is expired
            refreshTokenPromiseRef.current = getAccessTokenSilently().finally(() => {
              console.log('token has been refreshed');
              refreshTokenPromiseRef.current = null;
            });
          }
          return await refreshTokenPromiseRef.current;
        })();
      }

      if (shouldUseUrlToken) {
        return urlTokenFromUrl;
      }

      return undefined;
    })();

    activeTokenRef.current = token;
    return token;
  }, [getAccessTokenSilently, auth0Loaded, isAuthenticated, urlTokenFromUrl]);

  const updateClient = useCallback(async (): Promise<void> => {
    const token = await tryGetToken();

    const clientWithToken = new Oystehr({
      accessToken: token,
      projectApiUrl: import.meta.env.VITE_APP_PROJECT_API_URL,
      projectId: import.meta.env.VITE_APP_PROJECT_ID,

      // fetch interceptor responsible for:
      // - Checks token validity before each request and refreshes token if it is close to expiration (30s buffer)
      // - Logs out and redirects on token refresh failure
      fetch: async (req: Request) => {
        await auth0Loaded; // we need to wait for Auth0 state to be loaded before we can get the token; if we don't, we'll get a false positive logout
        const newToken = await tryGetToken();

        if (!newToken || !checkTokenIsValid(newToken)) {
          await logout({
            logoutParams: { returnTo: import.meta.env.VITE_APP_OYSTEHR_APPLICATION_REDIRECT_URL, federated: true },
          });
          throw new Error('token is invalid');
        }

        const headers = new Headers(req.headers);
        headers.set('Authorization', `Bearer ${newToken}`);

        return fetch(
          new Request(req, {
            headers: headers,
          })
        );
      },
    });

    setClientWithToken(clientWithToken);

    /**
     * TokenlessClient is a hybrid client that tries to use token-based auth first if available,
     * then falls back to tokenless mode.
     *
     * We preserve the token-first logic because:
     * 1. Previously we had a client with the same behavior
     * 2. Some tokenless zambdas have optional authenticated sections and produce different results
     *    if a token is not present (e.g., get-paperwork zambda)
     * 3. Forcing tokenless-only mode would cause regressions in these flows, since previously
     *    we always attempted token-based auth first when available, even in tokenless mode
     */
    setClientTokenless(() => {
      if (token) {
        return clientWithToken;
      }

      return new Oystehr({
        projectApiUrl: import.meta.env.VITE_APP_PROJECT_API_URL,
        projectId: import.meta.env.VITE_APP_PROJECT_ID,
      });
    });
  }, [tryGetToken, logout, auth0Loaded]);

  // Recreates client when auth state changes (isAuthenticated or URL token); fetch interceptor handles additional token validation during requests.
  useEffect(() => {
    void updateClient();
  }, [updateClient]);

  return (
    <IntakeClientsContext.Provider value={{ clientWithToken, clientTokenless }}>
      {children}
    </IntakeClientsContext.Provider>
  );
};
