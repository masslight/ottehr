import { APIGatewayProxyResult } from 'aws-lambda';
import { ZambdaInput, ProviderInfo } from '../types';
import { getAuth0Token } from '../shared/getAuth0Token';

export const register = async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  try {
    const accessToken = await getAuth0Token(input.secrets);
    const providerInfo: ProviderInfo = JSON.parse(input.body || '{}');

    // const result = await registerUser(accessToken, providerInfo); // to do register function

    // if (!result.success) {
    //   return {
    //     statusCode: 400,
    //     body: JSON.stringify({ error: 'Registration failed' }),
    //   };
    // }

    return {
      statusCode: 200,
      body: JSON.stringify({ message: 'Registration successful' }),
    };
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Internal Server Error' }),
    };
  }
};
