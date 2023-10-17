import { APIGatewayProxyResult } from 'aws-lambda';
import { ZambdaInput } from '../types';

export const index = async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  console.log(`Cancellation Input: ${JSON.stringify(input)}`);

  try {
    return {
      statusCode: 200,
      body: JSON.stringify({ version: 'TODO' }),
    };
  } catch (error: any) {
    console.log('error', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message }),
    };
  }
};
