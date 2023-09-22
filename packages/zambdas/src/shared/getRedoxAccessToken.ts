import queryString from 'query-string';
import { Secrets } from '../types';
import { getSignedAssertion } from './getSignedAssertion';

export const getRedoxAccessToken = async (secrets: Secrets | null): Promise<string> => {
  // TODO: we could cache and reuse the same token within the 5 minute window it exists once our volumes are higher
  // console.info('Retrieving new access token');
  const signedAssertion = await getSignedAssertion(secrets);
  const authBody = {
    grant_type: 'client_credentials',
    client_assertion_type: 'urn:ietf:params:oauth:client-assertion-type:jwt-bearer',
    client_assertion: signedAssertion,
  };
  const tokenUrl = 'https://api.redoxengine.com';
  console.log(authBody);
  const accessToken = await fetch(`${tokenUrl}/v2/auth/token`, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: queryString.stringify(authBody),
  })
    .then(async (result) => {
      if (!result.ok) {
        console.error('Fetching redox oauth access token resulted in error http code', result);
        console.log(await result.json());
        throw new Error('Fetch to redox for access token failed.');
      }
      return result.json();
    })
    .then((resultJson) => {
      // console.log('Redox oauth fetch result json', resultJson);
      return resultJson.access_token as string;
    })
    .catch((error) => {
      console.error('Error fetching redox oauth access token');
      throw new Error(error.message);
    });

  return accessToken;
};
