import { APIGatewayProxyResult } from 'aws-lambda';
import { ZambdaInput, topLevelCatch, makePresignedFileURL, getAppointmentResourceById } from 'ottehr-utils';
import { createFhirClient, getM2MClientToken } from '../shared';

export const index = async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  console.log(`Input: ${JSON.stringify(input)}`);
  try {
    const result = await makePresignedFileURL(input, getM2MClientToken, createFhirClient, getAppointmentResourceById);

    return {
      statusCode: 200,
      body: JSON.stringify(result),
    };
  } catch (error: any) {
    await topLevelCatch('get-presigned-file-url', error, input.secrets);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Internal error' }),
    };
  }
};
