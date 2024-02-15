import { APIGatewayProxyResult } from 'aws-lambda';
import { Secrets, ZambdaInput } from '../types';
import { SecretsKeys, getAuth0Token, getSecret } from '../shared';
import { topLevelCatch } from '../shared/errors';

let zapehrMessagingToken: string;
let twilioMessagingToken: string;
export const index = async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  const secrets = input.secrets;
  try {
    const response: any = {};
    const AUTH0_ENDPOINT = getSecret(SecretsKeys.AUTH0_ENDPOINT, secrets);
    const AUTH0_AUDIENCE = getSecret(SecretsKeys.AUTH0_AUDIENCE, secrets);
    if (!zapehrMessagingToken) {
      console.log('getting messaging token first');
      zapehrMessagingToken = await getAuth0Token(secrets, 'messaging');
      const twilioTokenRequest = await fetch(
        `${getSecret(SecretsKeys.PROJECT_API, secrets)}/messaging/conversation/token`,
        {
          headers: {
            Authorization: `Bearer ${zapehrMessagingToken}`,
          },
        },
      );
      const twilioTokenRequestJson = (await twilioTokenRequest.json()) as { token: string };
      twilioMessagingToken = twilioTokenRequestJson.token;
    } else {
      console.log('already have messaging token first');
    }

    response[`token`] = twilioMessagingToken;
    return {
      statusCode: 200,
      body: JSON.stringify(response),
    };
  } catch (error: any) {
    await topLevelCatch('admin-get-token-for-conversation', error, input.secrets);
    return {
      statusCode: 500,
      body: JSON.stringify({ message: 'Error getting token for conversation' }),
    };
  }
};

async function getToken(endpoint: string, audience: string, clientID: string, secretID: string): Promise<string> {
  return await fetch(endpoint, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      grant_type: 'client_credentials',
      client_id: clientID,
      client_secret: secretID,
      audience: audience,
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
      console.debug(`Fetch from ${endpoint} success`);
      return response.access_token;
    })
    .catch((error: any) => {
      console.error('error', error);
      throw new Error(error.message);
    });
}
