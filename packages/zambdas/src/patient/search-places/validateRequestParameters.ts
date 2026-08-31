import { Secrets } from 'utils/lib/secrets';
import { SearchPlacesInput } from 'utils/lib/types/data/search-places';
import { MISSING_REQUEST_BODY } from 'utils/lib/types/errors';
import { z } from 'zod';
import { ZambdaInput } from '../../shared/types/common';
import { safeJsonParse, safeValidate } from '../../shared/validation';

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
