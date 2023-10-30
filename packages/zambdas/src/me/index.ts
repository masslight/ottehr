import { APIGatewayProxyResult } from 'aws-lambda';
import { ZambdaInput } from '../types';
import { getAuth0Token } from '../shared/getAuth0Token';
import fetch from 'node-fetch';

export const index = async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  try {
    const accessToken = await getAuth0Token(input.secrets);
    console.log(accessToken);
    // const user = await getUser(accessToken);
    const url = 'https://project-api.zapehr.com/v1/m2m';
    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'x-zapehr-project-id': '2bea9e93-fd66-45d5-904a-568f1eebef37',
      },
      method: 'GET',
    });
    const data = await response.json();

    if (!accessToken) {
      return {
        statusCode: 404,
        body: JSON.stringify({ error: 'User not found' }),
      };
    }

    return {
      statusCode: 200,
      body: JSON.stringify(accessToken),
    };
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Internal Server Error' }),
    };
  }
};
