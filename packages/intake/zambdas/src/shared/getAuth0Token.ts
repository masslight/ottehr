import fetch from 'node-fetch';
import { getSecret, Secrets, SecretsKeys } from 'zambda-utils';
export async function getAuth0Token(secrets: Secrets | null): Promise<string> {
  const AUTH0_ENDPOINT = getSecret(SecretsKeys.AUTH0_ENDPOINT, secrets);
  const AUTH0_CLIENT = getSecret(SecretsKeys.AUTH0_CLIENT, secrets);
  const AUTH0_SECRET = getSecret(SecretsKeys.AUTH0_SECRET, secrets);
  const AUTH0_AUDIENCE = getSecret(SecretsKeys.AUTH0_AUDIENCE, secrets);

  console.group(`Fetch from ${AUTH0_ENDPOINT}`);
  return await fetch(AUTH0_ENDPOINT, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      grant_type: 'client_credentials',
      client_id: AUTH0_CLIENT,
      client_secret: AUTH0_SECRET,
      audience: AUTH0_AUDIENCE,
    }),
  })
    .then((response: any) => {
      if (!response.ok) {
        console.error('response issue', response);
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
