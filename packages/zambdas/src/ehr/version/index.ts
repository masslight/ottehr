import { APIGatewayProxyResult } from 'aws-lambda';
import { version } from '../../../package.json';
import { topLevelCatch } from '../shared/errors';

export const index = async (): Promise<APIGatewayProxyResult> => {
  try {
    return {
      statusCode: 200,
      body: JSON.stringify({ version: version }),
    };
  } catch (error: any) {
    await topLevelCatch('admin-update-user', error, null);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'error getting api version' }),
    };
  }
};
