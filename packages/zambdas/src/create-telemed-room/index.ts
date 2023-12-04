import { APIGatewayProxyResult } from 'aws-lambda';
import { createRoomEncounter, SecretsKeys, getAuth0Token, getM2MUserProfile, getSecret } from '../shared';
import { createZambdaFromSkeleton } from '../shared/zambdaSkeleton';
import fetch from 'node-fetch';
import { ZambdaFunctionInput, ZambdaFunctionResponse, ZambdaInput } from '../types';

export const index = async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  return createZambdaFromSkeleton(input, createTelemedRoom);
};

interface createTelemedRoomInput {
  patientName: string;
  practitionerId: string;
  practitionerName: string;
}

const createTelemedRoom = async (input: ZambdaFunctionInput): Promise<ZambdaFunctionResponse> => {
  const { body, secrets } = input;
  const { patientName, practitionerId, practitionerName } = body as createTelemedRoomInput;

  const providerProfile = `Practitioner/${practitionerId}`;
  const PROJECT_API = getSecret(SecretsKeys.PROJECT_API, secrets);
  const PROJECT_ID = getSecret(SecretsKeys.PROJECT_ID, secrets);

  const token = await getAuth0Token(secrets);
  console.log('token', token);

  const m2mUserProfile = await getM2MUserProfile(token, secrets);

  const encounter = createRoomEncounter(providerProfile, practitionerName, m2mUserProfile, patientName);

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
  return {
    response: {
      encounter: encounterData,
    },
  };
};
