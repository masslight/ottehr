import { useAuth0 } from '@auth0/auth0-react';
import Oystehr from '@oystehr/sdk';
import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';

const tokenlessClient = new Oystehr({
  projectApiUrl: import.meta.env.VITE_APP_PROJECT_API_URL,
  projectId: import.meta.env.VITE_APP_PROJECT_ID,
});

let clientWithToken: Oystehr | null = null;

export function useOystehrClient({ tokenless }: { tokenless: boolean }): Oystehr | null {
  const [client, setClient] = useState<Oystehr | null>(clientWithToken);
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
          clientWithToken = new Oystehr({
            accessToken: token,
            projectApiUrl: import.meta.env.VITE_APP_PROJECT_API_URL,
            projectId: import.meta.env.VITE_APP_PROJECT_ID,
          });
          setClient(clientWithToken);
        }
      } catch (e) {
        console.error('error refreshing token', JSON.stringify(e), e);
      } finally {
        setRefreshingToken(false);
      }
    }

    if (((isAuthenticated && !tokenless) || urlToken) && !clientWithToken) {
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
