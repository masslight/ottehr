import { APIGatewayProxyResult } from 'aws-lambda';
import { ZambdaFunctionInput, ZambdaFunctionResponse, ZambdaInput } from '../types';
import { SecretsKeys, getAuth0Token, getSecret } from '../shared';
import fetch from 'node-fetch';
import { createZambdaFromSkeleton } from '../shared/zambdaSkeleton';

export const index = async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  return createZambdaFromSkeleton(input, joinTelemedMeeting);
};
interface joinTelemedMeetingInput {
  encounterId: string;
}

export const joinTelemedMeeting = async (input: ZambdaFunctionInput): Promise<ZambdaFunctionResponse> => {
  const { body, secrets } = input;
  const { encounterId } = body as joinTelemedMeetingInput;
  console.log('body', body);

  const PROJECT_API = getSecret(SecretsKeys.PROJECT_API, secrets);
  const PROJECT_ID = getSecret(SecretsKeys.PROJECT_ID, secrets);

  const token = await getAuth0Token(secrets);
  console.log('token', token);

  const response = await fetch(`${PROJECT_API}/telemed/v2/meeting/${encounterId}/join`, {
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
  console.log('responseData', responseData);

  return {
    response: {
      joinInfo: responseData,
    },
  };
};
