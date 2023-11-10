import { APIGatewayProxyResult } from 'aws-lambda';
import { createFhirClient } from '../shared';
import { createZambdaFromSkeleton } from '../shared/zambdaSkeleton';
import { ZambdaFunctionInput, ZambdaFunctionResponse, ZambdaInput } from '../types';

export const index = async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  return createZambdaFromSkeleton(input, getPatientQueue);
};

interface getProviderInput {
  providerSlug: string;
}

const getPatientQueue = async (input: ZambdaFunctionInput): Promise<ZambdaFunctionResponse> => {
  const { body, secrets } = input;
  console.log('body', body);
  const { providerSlug } = body as getProviderInput;

  const fhirClient = await createFhirClient(secrets);

  const provider = await fhirClient.searchResources({
    resourceType: 'Practitioner',
    searchParams: [
      {
        name: 'identifier',
        value: providerSlug,
      },
    ],
  });
  return {
    response: {
      provider,
    },
  };
};
