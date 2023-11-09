import { APIGatewayProxyResult } from 'aws-lambda';
import { createFhirClient } from '../shared';
import { createZambdaFromSkeleton } from '../shared/zambdaSkeleton';
import { ZambdaFunctionInput, ZambdaFunctionResponse, ZambdaInput } from '../types';

export const index = async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  return createZambdaFromSkeleton(input, getPatientQueue);
};

interface getPatientQueueInput {
  providerId: string;
}

const getPatientQueue = async (input: ZambdaFunctionInput): Promise<ZambdaFunctionResponse> => {
  const { body, secrets } = input;
  console.log('body', body);
  const { providerId } = body as getPatientQueueInput;

  const fhirClient = await createFhirClient(secrets);

  const searchDate = new Date();
  const startOfDay = new Date(searchDate.setUTCHours(0, 0, 0, 0)).toISOString();

  const encountersSearchResults = await fhirClient.searchResources({
    resourceType: 'Encounter',
    searchParams: [
      {
        name: 'practitioner',
        value: `Practitioner/${providerId}`,
      },
      {
        name: 'status',
        value: 'arrived',
      },

      {
        name: 'date',
        value: `sa${startOfDay}`,
      },
    ],
  });

  return {
    response: {
      patientQueus: encountersSearchResults,
    },
  };
};
