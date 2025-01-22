import '../../instrument.mjs';
import { wrapHandler } from '@sentry/aws-serverless';
import { captureSentryException, configSentry } from '../shared';
import { APIGatewayProxyResult } from 'aws-lambda';
import { topLevelCatch, ZambdaInput } from 'utils';
import { version } from '../../package.json';

export const index = wrapHandler(async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  configSentry('version', input.secrets);
  try {
    return {
      statusCode: 200,
      body: JSON.stringify({ version: version }),
    };
  } catch (error: any) {
    return topLevelCatch('version', error, input.secrets, captureSentryException);
  }
});
