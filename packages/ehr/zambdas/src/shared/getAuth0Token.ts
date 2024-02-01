import fetch from 'node-fetch';
import { Secrets } from '../types';
import { getSecret, SecretsKeys } from './secrets';
export async function getAuth0Token(secrets: Secrets | null, type = 'regular'): Promise<string> {
  const AUTH0_ENDPOINT = getSecret(SecretsKeys.AUTH0_ENDPOINT, secrets);
  let AUTH0_CLIENT = undefined;
  let AUTH0_SECRET = undefined;
  if (type === 'regular') {
    AUTH0_CLIENT = getSecret(SecretsKeys.AUTH0_CLIENT, secrets);
    AUTH0_SECRET = getSecret(SecretsKeys.AUTH0_SECRET, secrets);
  } else if (type === 'messaging') {
    AUTH0_CLIENT = getSecret(SecretsKeys.MESSAGING_M2M_CLIENT, secrets);
    AUTH0_SECRET = getSecret(SecretsKeys.MESSAGING_M2M_SECRET, secrets);
  } else {
    console.log('unknown m2m token type');
    throw Error('unknown m2m token type');
  }
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
