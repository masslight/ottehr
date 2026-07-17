import { MISSING_REQUEST_BODY, SearchPlacesInput, Secrets } from 'utils';
import { z } from 'zod';
import { safeJsonParse, safeValidate, ZambdaInput } from '../../shared';

const bodySchema = z
  .object({
    searchTerm: z.string().optional(),
    locationBias: z
      .object({
        latitude: z.number(),
        longitude: z.number(),
      })
      .optional(),
    placesId: z.string().optional(),
  })
  .refine((data) => data.searchTerm || data.placesId, {
    message: 'searchTerm or placesId must be sent',
  })
  .refine((data) => !(data.searchTerm && data.placesId), {
    message: 'Please send either searchTerm or placesId, only one param should be sent.',
  });

export function validateRequestParameters(input: ZambdaInput): SearchPlacesInput & { secrets: Secrets | null } {
  if (!input.body) {
    throw MISSING_REQUEST_BODY;
  }

  const parsed = safeJsonParse(input.body);
  const { searchTerm, locationBias, placesId } = safeValidate(bodySchema, parsed);

  return {
    searchTerm,
    locationBias,
    placesId,
    secrets: input.secrets,
  };
}
