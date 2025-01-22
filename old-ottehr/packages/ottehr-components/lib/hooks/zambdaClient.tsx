import { useAuth0 } from '@auth0/auth0-react';
import { ZambdaClient } from '@zapehr/sdk';
import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';

const tokenlessClient = new ZambdaClient({
  apiUrl: import.meta.env.VITE_APP_PROJECT_API_URL,
});

let zambdaWithToken: ZambdaClient | null = null;

export function useZambdaClient({ tokenless }: { tokenless: boolean }): ZambdaClient | null {
  const [client, setClient] = useState<ZambdaClient | null>(zambdaWithToken);
  const { isAuthenticated, getAccessTokenSilently } = useAuth0();

  const [searchParams, _] = useSearchParams();
  const urlToken = searchParams.get('token');

  const [refreshingToken, setRefreshingToken] = useState(false);

  useEffect(() => {
    let token: string | null = null;

    async function setZambdaClientToken(): Promise<void> {
      setRefreshingToken(true);
      try {
        token = isAuthenticated ? await getAccessTokenSilently() : urlToken;
        if (token) {
          zambdaWithToken = new ZambdaClient({
            apiUrl: import.meta.env.VITE_APP_PROJECT_API_URL,
            accessToken: token,
          });
          setClient(zambdaWithToken);
        }
      } catch (e) {
        console.error('error refreshing token');
      } finally {
        setRefreshingToken(false);
      }
    }

    if (((isAuthenticated && !tokenless) || urlToken) && !zambdaWithToken) {
      setZambdaClientToken().catch((error) => console.log(error));
    }
  }, [getAccessTokenSilently, isAuthenticated, tokenless, urlToken]);

  if (tokenless) {
    return tokenlessClient;
  } else if (!refreshingToken) {
    return client;
  }
  return null;
}
