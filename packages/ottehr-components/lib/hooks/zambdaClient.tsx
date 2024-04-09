import { useAuth0 } from '@auth0/auth0-react';
import { ZambdaClient } from '@zapehr/sdk';
import { useEffect, useState } from 'react';

const tokenlessClient = new ZambdaClient({
  apiUrl: import.meta.env.VITE_APP_PROJECT_API_URL,
});

let zambdaWithToken: ZambdaClient | null = null;

export function useZambdaClient({ tokenless }: { tokenless: boolean }): ZambdaClient | null {
  const [client, setClient] = useState<ZambdaClient | null>(zambdaWithToken);
  const { isAuthenticated, getAccessTokenSilently } = useAuth0();

  useEffect(() => {
    let token: string | undefined = undefined;

    async function setZambdaClientToken(): Promise<void> {
      token = await getAccessTokenSilently();
      if (token) {
        zambdaWithToken = new ZambdaClient({
          apiUrl: import.meta.env.VITE_APP_PROJECT_API_URL,
          accessToken: token,
        });
        setClient(zambdaWithToken);
      }
    }

    if (isAuthenticated && !tokenless && !zambdaWithToken) {
      setZambdaClientToken().catch((error) => console.log(error));
    }
  }, [getAccessTokenSilently, isAuthenticated, tokenless]);

  return tokenless ? tokenlessClient : client;
}
