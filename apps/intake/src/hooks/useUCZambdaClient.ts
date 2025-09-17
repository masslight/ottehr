import { useAuth0 } from '@auth0/auth0-react';
import { decodeJwt, JWTPayload } from 'jose';
import { useCallback, useMemo } from 'react';
import { chooseJson } from 'utils';

export interface ZambdaClient {
  execute: (id: string, body?: any) => Promise<any>;
  executePublic: (id: string, body?: any) => Promise<any>;
}

const apiUrl = import.meta.env.VITE_APP_PROJECT_API_URL;

const baseHeaders = {
  'content-type': 'application/json',
  'x-zapehr-project-id': import.meta.env.VITE_APP_PROJECT_ID,
};

export function useUCZambdaClient({ tokenless }: { tokenless: boolean }): ZambdaClient | null {
  const { isAuthenticated, getAccessTokenSilently, logout } = useAuth0();

  const executePublic = useCallback(
    async (id: string, body?: any): Promise<any> => {
      let responseRef: Response | undefined;

      try {
        let token: string | undefined;

        try {
          if (isAuthenticated && getAccessTokenSilently) {
            token = await getAccessTokenSilently();
          }
        } catch {
          // no biggie
        }

        const headers = token
          ? {
              ...baseHeaders,
              Authorization: `Bearer ${token}`,
            }
          : { ...baseHeaders };

        const response = await fetch(`${apiUrl}/zambda/${id}/execute-public`, {
          method: 'POST',
          headers,
          body: body ? JSON.stringify(body) : undefined,
        });
        console.log('response from execute-public', JSON.stringify(response));
        if (!response.ok) {
          throw await response.json();
        }
        responseRef = response;
        return response.json();
      } catch (e) {
        const errorDetails = {
          zambdaId: id,
          requestBody: body,
          error: chooseJson(e),
          responseText: responseRef && !responseRef.bodyUsed ? await responseRef.text() : null,
        };

        console.error(`Error invoking tokenless zambda: ${JSON.stringify(errorDetails)}`);
        throw chooseJson(e);
      }
    },
    [getAccessTokenSilently, isAuthenticated]
  );

  const execute = useCallback(
    async (id: string, body?: any): Promise<any> => {
      let token: string;
      if (isAuthenticated && getAccessTokenSilently) {
        token = await getAccessTokenSilently();
        const isValid = checkTokenIsValid(token);
        if (!isValid) {
          console.error('Session is invalid or expired, logging user out.');
          void logout({
            logoutParams: { returnTo: import.meta.env.VITE_APP_OYSTEHR_APPLICATION_REDIRECT_URL, federated: true },
          });
          throw new Error('Session is invalid or expired');
        }
      } else {
        throw new Error('User is not authenticated');
      }
      let responseRef: Response | undefined;
      try {
        const response = await fetch(`${apiUrl}/zambda/${id}/execute`, {
          method: 'POST',
          headers: {
            ...baseHeaders,
            Authorization: `Bearer ${token}`,
          },
          body: body ? JSON.stringify(body) : undefined,
        });
        console.log('response from execute', JSON.stringify(response));
        if (!response.ok) {
          throw await response.json();
        }
        responseRef = response;
        return response.json();
      } catch (e) {
        const errorDetails = {
          zambdaId: id,
          requestBody: body,
          error: chooseJson(e),
          responseText: responseRef && !responseRef.bodyUsed ? await responseRef.text() : null,
        };

        console.error(`Error invoking zambda: ${JSON.stringify(errorDetails)}`);
        throw chooseJson(e);
      }
    },
    [getAccessTokenSilently, isAuthenticated, logout]
  );

  const client = useMemo(() => {
    if (isAuthenticated) {
      return {
        execute,
        executePublic,
      };
    } else if (tokenless) {
      return {
        execute,
        executePublic,
      };
    } else {
      return null;
    }
  }, [execute, executePublic, isAuthenticated, tokenless]);

  return client;
}

const checkTokenIsValid = (token: string): boolean => {
  let decoded: JWTPayload | undefined;
  try {
    decoded = decodeJwt(token);
  } catch {
    return false;
  }
  if (!decoded || !decoded.exp) return false;

  const now = Math.floor(Date.now() / 1000);
  return decoded.exp > now;
};
