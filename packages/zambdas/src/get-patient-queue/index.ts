import { APIGatewayProxyResult } from 'aws-lambda';
import { createFhirClient } from '../shared';
import { createZambdaFromSkeleton } from '../shared/zambdaSkeleton';
import { ZambdaFunctionInput, ZambdaFunctionResponse, ZambdaInput } from '../types';
import { Encounter } from 'fhir/r4';

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

  const encountersSearchResults: Encounter[] = await fhirClient.searchResources({
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

  const patientsQueue = encountersSearchResults.map((encounter) => {
    const patientNameExtension = encounter.extension
      ?.find((ext) => ext.url === 'https://extensions.fhir.zapehr.com/encounter-other-participants')
      ?.extension?.find((ext) => ext.url === 'https://extensions.fhir.zapehr.com/encounter-other-participant')
      ?.extension?.find((ext) => ext.url === 'reference' && ext.valueReference?.display);

    const patientName = patientNameExtension?.valueReference?.display;
    const queuedTime = encounter.period?.start;

    return {
      encounterId: encounter.id,
      patientName,
      queuedTime,
    };
  });

  return {
    response: {
      patientsQueue,
    },
  };
};
