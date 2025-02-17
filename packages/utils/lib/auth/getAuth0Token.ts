import axios from 'axios';
import { Secrets, getSecret, SecretsKeys } from 'utils';

export interface GetAuthTokenInput {
  clientIdKey: SecretsKeys;
  secretIdKey: SecretsKeys;
  secrets: Secrets | null;
}

// Throws if it can't get a token because this is a fatal error
export async function getAuth0Token(input: GetAuthTokenInput): Promise<string> {
  const { clientIdKey, secretIdKey, secrets } = input;
  const AUTH0_ENDPOINT = getSecret(SecretsKeys.AUTH0_ENDPOINT, secrets);
  const AUTH0_AUDIENCE = getSecret(SecretsKeys.AUTH0_AUDIENCE, secrets);
  const AUTH0_CLIENT = getSecret(clientIdKey, secrets);
  const AUTH0_SECRET = getSecret(secretIdKey, secrets);

  console.group(`Fetch from ${AUTH0_ENDPOINT}`);
  return await axios({
    url: AUTH0_ENDPOINT,
    method: 'post',
    headers: {
      'content-type': 'application/json',
    },
    data: {
      grant_type: 'client_credentials',
      client_id: AUTH0_CLIENT,
      client_secret: AUTH0_SECRET,
      audience: AUTH0_AUDIENCE,
    },
  })
    .then((response: any) => {
      if (response.statusText != 'OK') {
        console.error('response issue', response);
        throw new Error(response);
      }
      console.log('Got a response from auth0');
      return response.data;
    })
    .then((response: any) => {
      console.groupEnd();
      console.debug(`Fetch from ${AUTH0_ENDPOINT} success`);
      return response.access_token;
    })
    .catch((error: any) => {
      console.error('error', JSON.stringify(error));
      throw new Error(error.message);
    });
}
