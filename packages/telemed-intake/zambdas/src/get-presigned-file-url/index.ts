import { APIGatewayProxyResult } from 'aws-lambda';
import { ZambdaInput, getAppointmentResourceById, makePresignedFileURL, topLevelCatch } from 'ottehr-utils';
import { createFhirClient, getM2MClientToken } from '../shared';

let zapehrToken: string;

export const index = async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  console.log(`Input: ${JSON.stringify(input)}`);
  try {
    if (!zapehrToken) {
      console.log('getting token');
      zapehrToken = await getM2MClientToken(input.secrets);
    } else {
      console.log('already have token');
    }
    const result = await makePresignedFileURL(input, createFhirClient, getAppointmentResourceById, zapehrToken);

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
