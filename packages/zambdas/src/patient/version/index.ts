import { wrapHandler } from '@sentry/aws-serverless';
import { APIGatewayProxyResult } from 'aws-lambda';
import { topLevelCatch, ZambdaInput } from 'zambda-utils';
import { version } from '../../../package.json';
import { captureSentryException, configSentry } from '../../shared';
import '../../shared/instrument.mjs';

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
