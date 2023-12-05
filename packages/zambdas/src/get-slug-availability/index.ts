import { APIGatewayProxyResult } from 'aws-lambda';
import { ErrorCodes, ZambdaFunctionInput, ZambdaFunctionResponse, ZambdaInput } from '../types';
import { createZambdaFromSkeleton } from '../shared/zambdaSkeleton';
import { availability, createFhirClient, regex } from '../shared';

export const index = async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  return createZambdaFromSkeleton(input, getSlugAvailability);
};

interface getSlugAvailabilityInput {
  slug: string;
}

const getSlugAvailability = async (input: ZambdaFunctionInput): Promise<ZambdaFunctionResponse> => {
  const { slug } = input.body as getSlugAvailabilityInput;
  const { secrets } = input;
  if (slug == null || typeof slug !== 'string') {
    console.error('"slug" must be provided and be a string.');
    return {
      error: ErrorCodes.mustBeString,
    };
  }
  if (!regex.alphanumeric.test(slug)) {
    console.error('"slug" must only contain alphanumeric characters.');
    return {
      error: ErrorCodes.mustBeAlphanumeric,
    };
  }
  const potentialSlug = slug.toLowerCase();

  const fhirClient = await createFhirClient(secrets);

  const available = await availability(potentialSlug, fhirClient);

  return {
    response: {
      available,
    },
  };
};
