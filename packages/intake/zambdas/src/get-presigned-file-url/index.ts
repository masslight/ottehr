import '../../instrument.mjs';
import { wrapHandler } from '@sentry/aws-serverless';
import { captureSentryException, configSentry } from '../shared';
import { APIGatewayProxyResult } from 'aws-lambda';
import { ZambdaInput, getAppointmentResourceById, makePresignedFileURL, topLevelCatch } from 'utils';
import { getM2MClientToken } from '../shared';
import { createOystehrClient } from '../shared/helpers';

let zapehrToken: string;

export const index = wrapHandler(async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  configSentry('get-presigned-file-url', input.secrets);
  console.log(`Input: ${JSON.stringify(input)}`);
  try {
    if (!zapehrToken) {
      zapehrToken = await getM2MClientToken(input.secrets);
    }
    const result = await makePresignedFileURL(input, createOystehrClient, getAppointmentResourceById, zapehrToken);

    return {
      statusCode: 200,
      body: JSON.stringify(result),
    };
  } catch (error: any) {
    return topLevelCatch('get-presigned-file-url', error, input.secrets, captureSentryException);
  }
});
