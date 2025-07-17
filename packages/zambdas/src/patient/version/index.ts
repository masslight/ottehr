import { APIGatewayProxyResult } from 'aws-lambda';
import { getSecret, SecretsKeys } from 'utils';
import { version } from '../../../package.json';
import { topLevelCatch, wrapHandler, ZambdaInput } from '../../shared';

export const index = wrapHandler('get-version', async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  try {
    return {
      statusCode: 200,
      body: JSON.stringify({ version: version }),
    };
  } catch (error: any) {
    const ENVIRONMENT = getSecret(SecretsKeys.ENVIRONMENT, input.secrets);
    return topLevelCatch('version', error, ENVIRONMENT);
  }
});
