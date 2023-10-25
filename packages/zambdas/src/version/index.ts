import { APIGatewayProxyResult } from 'aws-lambda';
import { ZambdaInput } from '../types';

export const index = async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  console.log(`Cancellation Input: ${JSON.stringify(input)}`);

  try {
    return {
      body: JSON.stringify({ version: 'TODO' }),
      statusCode: 200,
    };
  } catch (error: any) {
    console.log('error', error);
    return {
      body: JSON.stringify({ error: error.message }),
      statusCode: 500,
    };
  }
};
