import fetch from 'node-fetch';
import { Secrets } from 'ottehr-utils';
import { getSecret, SecretsKeys } from './secrets';

// Throws if it can't get a token because this is a fatal error
export async function getAuth0Token(secrets: Secrets | null): Promise<string> {
  const AUTH0_AUDIENCE = getSecret(SecretsKeys.AUTH0_AUDIENCE, secrets);
  const AUTH0_CLIENT = getSecret(SecretsKeys.AUTH0_CLIENT, secrets);

  const AUTH0_ENDPOINT = getSecret(SecretsKeys.AUTH0_ENDPOINT, secrets);
  const AUTH0_SECRET = getSecret(SecretsKeys.AUTH0_SECRET, secrets);

  console.group(`Fetch from ${AUTH0_ENDPOINT}`);

  return await fetch(AUTH0_ENDPOINT, {
    body: JSON.stringify({
      audience: AUTH0_AUDIENCE,
      client_id: AUTH0_CLIENT,
      client_secret: AUTH0_SECRET,
      grant_type: 'client_credentials',
    }),
    headers: {
      'content-type': 'application/json',
    },
    method: 'POST',
  })
    .then((response: any) => {
      if (!response.ok) {
        response.json().then(console.error);
        throw new Error(response);
      }
      console.log('Got a response from auth0');
      return response.json();
    })
    .then((response: any) => {
      console.groupEnd();
      console.debug(`Fetch from ${AUTH0_ENDPOINT} success`);
      return response.access_token;
    })
    .catch((error: any) => {
      console.error('error', error);
      throw new Error(error.message);
    });
}
