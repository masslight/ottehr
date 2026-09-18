import { useAuth0 } from '@auth0/auth0-react';
import { useEffect, useState } from 'react';

let _token: string | undefined = undefined;
let _tokenPromise: Promise<string> | undefined = undefined;

export function useAuthToken(): string | undefined {
  const { isAuthenticated, getAccessTokenSilently } = useAuth0();
  const [token, setToken] = useState<string | undefined>(_token);

  useEffect(() => {
    if (!isAuthenticated || token) {
      return;
    }

    if (_token) {
      setToken(_token);
      return;
    }

    if (!_tokenPromise) {
      _tokenPromise = getAccessTokenSilently().then(
        (newToken) => {
          _token = newToken;
          return newToken;
        },
        (error) => {
          _tokenPromise = undefined; // let a later consumer retry
          throw error;
        }
      );
    }

    let active = true;
    _tokenPromise
      .then((newToken) => {
        if (active) {
          setToken(newToken);
        }
      })
      .catch(() => console.error('Unable to get auth0 token'));

    return () => {
      active = false;
    };
  }, [isAuthenticated, getAccessTokenSilently, token]);

  return token;
}
