import { APIGatewayProxyResult } from 'aws-lambda';
import { ZambdaInput } from '../types';
import { getAuth0Token } from '../shared/getAuth0Token';
import fetch from 'node-fetch';

export const index = async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  try {
    const accessToken = await getAuth0Token(input.secrets);
    console.log(accessToken);
    const url = 'https://project-api.zapehr.com/v1/project';
    const response = await fetch(url, {
      body: JSON.stringify({
        defaultPatientAccessPolicy: {
          rule: [
            {
              action: ['FHIR:Read', 'FHIR:Search'],
              effect: 'Allow',
              resource: ['FHIR:Patient:*'],
            },
          ],
        },
        description: 'updated project description',
        name: 'SANDBOX',
        signupEnabled: true,
      }),
      headers: {
        accept: 'application/json',
        authorization: `Bearer ${accessToken}`,
        'content-type': 'application/json',
      },
      method: 'PUT',
    });
    const data = await response.json();
    console.log(data);
    if (!accessToken) {
      return {
        body: JSON.stringify({ error: 'User not found' }),
        statusCode: 404,
      };
    }

    return {
      body: JSON.stringify(response),
      statusCode: 200,
    };
  } catch (error) {
    return {
      body: JSON.stringify({ error: 'Internal Server Error' }),
      statusCode: 500,
    };
  }
};
