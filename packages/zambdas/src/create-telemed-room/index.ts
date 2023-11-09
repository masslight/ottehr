import { APIGatewayProxyResult } from 'aws-lambda';
import { createRoomEncounter, SecretsKeys, getAuth0Token, getM2MUserProfile, getSecret } from '../shared';
import { createZambdaFromSkeleton } from '../shared/zambdaSkeleton';
import fetch from 'node-fetch';
import { ZambdaFunctionInput, ZambdaFunctionResponse, ZambdaInput } from '../types';

export const index = async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  return createZambdaFromSkeleton(input, createTelemedRoom);
};

const createTelemedRoom = async (input: ZambdaFunctionInput): Promise<ZambdaFunctionResponse> => {
  const PROVIDER_PROFILE = 'Practitioner/ded0ff7e-1c5b-40d5-845b-3ae679de95cd';
  const { body, secrets } = input;
  console.log('body', body);

  const PROJECT_API = getSecret(SecretsKeys.PROJECT_API, secrets);
  const PROJECT_ID = getSecret(SecretsKeys.PROJECT_ID, secrets);

  const token = await getAuth0Token(secrets);
  console.log('token', token);

  const m2mUserProfile = await getM2MUserProfile(token);

  const encounter = createRoomEncounter(PROVIDER_PROFILE, m2mUserProfile, 'John', 'Doe');
  console.log('encounter', encounter);

  const response = await fetch(`${PROJECT_API}/telemed/room`, {
    body: JSON.stringify(encounter),
    headers: {
      Authorization: `Bearer ${token}`,
      'content-type': 'application/json',
      'x-zapehr-project-id': PROJECT_ID,
    },
    method: 'POST',
  });
  if (!response.ok) {
    throw new Error(`API call failed: ${response.statusText}`);
  }
  const responseData = await response.json();
  const encounterData = responseData.encounter;
  console.log('responseData', responseData);
  return {
    response: {
      encounter: encounterData,
    },
  };
};
