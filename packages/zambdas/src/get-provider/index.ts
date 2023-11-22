import { APIGatewayProxyResult } from 'aws-lambda';
import { createFhirClient } from '../shared';
import { createZambdaFromSkeleton } from '../shared/zambdaSkeleton';
import { ZambdaFunctionInput, ZambdaFunctionResponse, ZambdaInput } from '../types';
import { Practitioner } from 'fhir/r4';

export const index = async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  return createZambdaFromSkeleton(input, getProvider);
};

interface getProviderInput {
  slug: string;
}

const getProvider = async (input: ZambdaFunctionInput): Promise<ZambdaFunctionResponse> => {
  const { body, secrets } = input;
  console.log('body', body);
  const { slug } = body as getProviderInput;

  const fhirClient = await createFhirClient(secrets);
  const providerResponse = await fhirClient.searchResources({
    resourceType: 'Practitioner',
    searchParams: [
      {
        name: 'identifier',
        value: slug,
      },
    ],
  });

  if (!providerResponse.length) {
    return {
      response: {
        providerData: null,
      },
    };
  }

  const provider = providerResponse[0] as Practitioner;
  const providerData = {
    firstName: provider.name?.[0].given?.join(' '),
    id: provider.id,
    lastName: provider.name?.[0].family,
    title: provider.name?.[0].prefix?.[0],
  };
  return {
    response: {
      providerData,
    },
  };
};
