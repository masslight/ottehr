/* eslint-disable @typescript-eslint/no-unused-vars */
import { APIGatewayProxyResult } from 'aws-lambda';
import { ZambdaInput } from '../types';
import { SecretsKeys, getAuth0Token, getM2MUserProfile, getSecret } from '../shared';
import { validateRequestParameters } from './validateRequestParameters';
import fetch from 'node-fetch';

export const index = async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  try {
    console.group('validateRequestParameters');
    const validatedParameters = validateRequestParameters(input);
    const { body, secrets } = validatedParameters;
    console.log('body', body);
    // TODO: after registration/onboarding is done we should pass the patient/practitioner data to create the encounter
    console.groupEnd();

    const PROJECT_API = getSecret(SecretsKeys.PROJECT_API, secrets);
    const PROJECT_ID = getSecret(SecretsKeys.PROJECT_ID, secrets);
    const TELEMED_VIDEO_DEVICE_ID = '60c69e39-97fa-4f15-ba49-6261fdd65186';

    const token = await getAuth0Token(secrets, 'provider-m2m');
    console.log('token', token);

    const encounterID = body.encounterId;

    const response = await getM2MUserProfile(token, PROJECT_ID, TELEMED_VIDEO_DEVICE_ID);

    // const response = await fetch(`${PROJECT_API}/telemed/token?encounterId=${encounterID}`, {
    //   headers: {
    //     Authorization: `Bearer ${token}`,
    //     'content-type': 'application/json',
    //     'x-zapehr-project-id': PROJECT_ID,
    //   },
    //   method: 'GET',
    // });
    // if (!response.ok) {
    //   throw new Error(`API call failed: ${response.statusText}`);
    // }

    // const responseData = await response.json();
    const responseData = response;
    console.log('responseData', responseData);

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
