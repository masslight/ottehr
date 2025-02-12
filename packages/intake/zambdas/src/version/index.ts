import { wrapHandler } from '@sentry/aws-serverless';
import { APIGatewayProxyResult } from 'aws-lambda';
import {} from 'utils';
import { ZambdaInput } from 'zambda-utils';
import { topLevelCatch } from 'zambda-utils';
import '../../instrument.mjs';
import { version } from '../../package.json';
import { captureSentryException, configSentry } from '../shared';

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
