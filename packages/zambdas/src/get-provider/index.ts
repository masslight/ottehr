import { APIGatewayProxyResult } from 'aws-lambda';
import { createFhirClient } from '../shared';
import { createZambdaFromSkeleton } from '../shared/zambdaSkeleton';
import { ZambdaFunctionInput, ZambdaFunctionResponse, ZambdaInput } from '../types';

export const index = async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  return createZambdaFromSkeleton(input, getProvider);
};

interface getProviderInput {
  providerSlug: string;
}
interface Practitioner {
  id: string;
  name: Array<{
    text?: string;
  }>;
}
const getProvider = async (input: ZambdaFunctionInput): Promise<ZambdaFunctionResponse> => {
  const { body, secrets } = input;
  console.log('body', body);
  const { providerSlug } = body as getProviderInput;

  const fhirClient = await createFhirClient(secrets);

  const providerResponse = await fhirClient.searchResources({
    resourceType: 'Practitioner',
    searchParams: [
      {
        name: 'identifier',
        value: providerSlug,
      },
    ],
  });
  const provider = providerResponse[0] as Practitioner;
  const providerData = {
    id: provider.id,
    name: provider.name?.[0].text,
  };
  return {
    response: {
      providerData,
    },
  };
};
