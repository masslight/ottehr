import { APIGatewayProxyResult } from 'aws-lambda';
import { ZambdaInput } from '../types';
import { getAuth0Token } from '../shared/getAuth0Token';
import fetch from 'node-fetch';

export const index = async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  try {
    const accessToken = await getAuth0Token(input.secrets);
    const url = 'https://project-api.zapehr.com/v1/project';
    const response = await fetch(url, {
      body: JSON.stringify({
        name: 'SANDBOX',
        description: 'updated project description',
        signupEnabled: true,
        defaultPatientAccessPolicy: {
          rule: [
            {
              resource: ['FHIR:Patient:*'],
              action: ['FHIR:Read', 'FHIR:Search'],
              effect: 'Allow',
            },
          ],
        },
      }),
      method: 'PUT',
      headers: {
        accept: 'application/json',
        'content-type': 'application/json',
        authorization: `Bearer ${accessToken}`,
      },
    });
    const data = await response.json();
    console.log(data);
    if (!accessToken) {
      return {
        statusCode: 404,
        body: JSON.stringify({ error: 'User not found' }),
      };
    }

    return {
      statusCode: 200,
      body: JSON.stringify(response),
    };
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Internal Server Error' }),
    };
  }
};
