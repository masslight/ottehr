import { APIGatewayProxyResult } from 'aws-lambda';
import { ZambdaFunctionInput, ZambdaFunctionResponse, ZambdaInput } from '../types';
import { SecretsKeys, getAuth0Token, getSecret } from '../shared';
import fetch from 'node-fetch';
import { createZambdaFromSkeleton } from '../shared/zambdaSkeleton';

export const index = async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  return createZambdaFromSkeleton(input, getTelemedToken);
};
interface getTelemedTokenInput {
  encounterId: string;
}

export const getTelemedToken = async (input: ZambdaFunctionInput): Promise<ZambdaFunctionResponse> => {
  const { body, secrets } = input;
  const { encounterId } = body as getTelemedTokenInput;
  console.log('body', body);

  const PROJECT_API = getSecret(SecretsKeys.PROJECT_API, secrets);
  const PROJECT_ID = getSecret(SecretsKeys.PROJECT_ID, secrets);

  const token = await getAuth0Token(secrets);
  console.log('token', token);

  const response = await fetch(`${PROJECT_API}/telemed/token?encounterId=${encounterId}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      'content-type': 'application/json',
      'x-zapehr-project-id': PROJECT_ID,
    },
    method: 'GET',
  });
  if (!response.ok) {
    throw new Error(`API call failed: ${response.statusText}`);
  }

  const responseData = await response.json();
  const twilioToken = responseData.token;
  console.log('responseData', responseData);

  return {
    response: {
      token: twilioToken,
    },
  };
};
