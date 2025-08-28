import { APIGatewayProxyResult } from 'aws-lambda';
import { ZambdaInput } from '../../shared';

export const index = async (_input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  try {
    return {
      body: JSON.stringify('i did nothing successfully'),
      statusCode: 200,
    };
  } catch (error: any) {
    console.log('top level catch, ', error);
    return {
      body: JSON.stringify('i failed to do nothing successfully - top level catch'),
      statusCode: 500,
    };
  }
};
