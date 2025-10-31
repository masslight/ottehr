import { useAuth0 } from '@auth0/auth0-react';
import Oystehr from '@oystehr/sdk';
import { createContext, FC, PropsWithChildren, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { checkTokenIsValid } from 'src/api/tokenUtils';

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

  const clientTokenlessRef = useRef<Oystehr | null>(
    new Oystehr({
      projectApiUrl: import.meta.env.VITE_APP_PROJECT_API_URL,
      projectId: import.meta.env.VITE_APP_PROJECT_ID,
    })
  );

  const { isAuthenticated, getAccessTokenSilently, logout } = useAuth0();
  const [searchParams, _] = useSearchParams();
  const urlTokenFromUrl = searchParams.get('token') ?? undefined;
  const refreshTokenPromiseRef = useRef<Promise<string | undefined> | null>(null);
  const activeTokenRef = useRef<string | undefined>(undefined);

  // If user is authenticated, Auth0 token is used;
  // if not authenticated but URL token is present, URL token is used;
  // otherwise return undefined
  const tryGetToken = useCallback(async (): Promise<string | undefined> => {
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
  }, [getAccessTokenSilently, isAuthenticated, urlTokenFromUrl]);

  const updateClient = useCallback(async (): Promise<void> => {
    setClientWithToken(
      new Oystehr({
        accessToken: await tryGetToken(),
        projectApiUrl: import.meta.env.VITE_APP_PROJECT_API_URL,
        projectId: import.meta.env.VITE_APP_PROJECT_ID,

        // fetch interceptor responsible for:
        // - Checks token validity before each request and refreshes token if it is close to expiration (30s buffer);
        //   Oystehr returns 500 instead of 401 for invalid tokens, making status-based retry unreliable;
        //   buffer ensures valid tokens while minimizing refresh requests
        // - Logs out and redirects on token refresh failure
        fetch: async (req: Request) => {
          if (activeTokenRef.current && checkTokenIsValid(activeTokenRef.current)) {
            return fetch(req);
          }

          // 'client' will be updated as well since 'isAuthenticated' dep will be updated and 'updateClient' will be called inside the useEffect
          const newToken = await tryGetToken();

          if (!newToken || !checkTokenIsValid(newToken)) {
            console.error('token is invalid, logging out');

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
      })
    );
  }, [tryGetToken, logout]);

  // Recreates client when auth state changes (isAuthenticated or URL token); fetch interceptor handles additional token validation during requests.
  useEffect(() => {
    void updateClient();
  }, [updateClient]);

  return (
    <IntakeClientsContext.Provider value={{ clientWithToken, clientTokenless: clientTokenlessRef.current }}>
      {children}
    </IntakeClientsContext.Provider>
  );
};
