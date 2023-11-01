/* eslint-disable @typescript-eslint/no-unused-vars */
import { APIGatewayProxyResult } from 'aws-lambda';
import { ZambdaInput } from '../types';
import { SecretsKeys, getAuth0Token, getSecret } from '../shared';
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

    const token = await getAuth0Token(secrets);
    console.log('token', token);

    const encounterID = body.encounterId;

    const response = await fetch(`${PROJECT_API}/telemed/token?encounterId=${encounterID}`, {
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
