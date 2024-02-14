import { ZambdaInput } from 'ottehr-utils';
import { GetSlotsAvailabilityInput } from '.';

export function validateRequestParameters(input: ZambdaInput): GetSlotsAvailabilityInput {
  if (!input.body) {
    throw new Error('No request body provided');
  }

  const { locationSlug } = JSON.parse(input.body);
  if (!locationSlug) {
    throw new Error('locationSlug not found. locationSlug is required');
  }

  return {
    locationSlug,
    secrets: input.secrets,
  };
}
