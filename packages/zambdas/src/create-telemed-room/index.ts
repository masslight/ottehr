/* eslint-disable @typescript-eslint/no-unused-vars */
import { APIGatewayProxyResult } from 'aws-lambda';
import { ZambdaInput } from '../types';
import { getAuth0Token } from '../shared';
import { validateRequestParameters } from './validateRequestParameters';
import fetch from 'node-fetch';

export const index = async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  const PROJECT_ID = '4564eab4-c85f-48e6-97a9-1382c39f07c4';
  try {
    console.group('validateRequestParameters');
    const validatedParameters = validateRequestParameters(input);
    const { body, secrets } = validatedParameters;
    console.log('body', body);
    console.groupEnd();

    const token = await getAuth0Token(secrets);
    console.log('token', token);
    // const validEncounter = CREATE_ROOM_VALID_ENCOUNTER();

    const response = await fetch('https://testing.project-api.zapehr.com/v1/telemed/room', {
      body: JSON.stringify(''),
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
