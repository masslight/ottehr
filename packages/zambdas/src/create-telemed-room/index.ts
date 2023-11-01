/* eslint-disable @typescript-eslint/no-unused-vars */
import { APIGatewayProxyResult } from 'aws-lambda';
import { ZambdaInput } from '../types';
import { createRoomEncounter, SecretsKeys, getAuth0Token, getM2MUserProfile, getSecret } from '../shared';
import { validateRequestParameters } from './validateRequestParameters';
import fetch from 'node-fetch';

export const index = async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  const PROVIDER_PROFILE = 'Practitioner/ded0ff7e-1c5b-40d5-845b-3ae679de95cd';

  try {
    console.group('validateRequestParameters');
    const validatedParameters = validateRequestParameters(input);
    const { body, secrets } = validatedParameters;
    console.log('body', body);
    console.groupEnd();

    const token = await getAuth0Token(secrets);
    console.log('token', token);

    const PROJECT_API = getSecret(SecretsKeys.PROJECT_API, secrets);
    const PROJECT_ID = getSecret(SecretsKeys.PROJECT_ID, secrets);
    const TELEMED_VIDEO_DEVICE_ID = getSecret(SecretsKeys.TELEMED_VIDEO_DEVICE_ID, secrets);

    const m2mUserProfile = await getM2MUserProfile(token, PROJECT_ID, TELEMED_VIDEO_DEVICE_ID);

    const encounter = createRoomEncounter(PROVIDER_PROFILE, m2mUserProfile);
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

    return {
      body: JSON.stringify({
        version: responseData,
      }),
      statusCode: 200,
    };
  } catch (error: any) {
    console.log('error', error);
    return {
      body: JSON.stringify({
        error: error.message,
      }),
      statusCode: 500,
    };
  }
};
