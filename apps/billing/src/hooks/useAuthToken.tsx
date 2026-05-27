import { useAuth0 } from '@auth0/auth0-react';
import { useEffect, useState } from 'react';

let _token: string | undefined = undefined;

export function useAuthToken(): string | undefined {
  const { isAuthenticated, getAccessTokenSilently } = useAuth0();
  const [token, setToken] = useState<string | undefined>(_token);

  useEffect(() => {
    if (isAuthenticated && !_token) {
      getAccessTokenSilently()
        .then((newToken) => {
          _token = newToken;
          setToken(newToken);
        })
        .catch(() => console.error('Unable to get auth0 token'));
    }
  }, [isAuthenticated, getAccessTokenSilently, setToken]);

  return token;
}
