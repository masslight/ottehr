import { MISSING_REQUEST_BODY, SearchPlacesInput, Secrets } from 'utils';
import { ZambdaInput } from '../../shared';

export function validateRequestParameters(input: ZambdaInput): SearchPlacesInput & { secrets: Secrets | null } {
  if (!input.body) {
    throw MISSING_REQUEST_BODY;
  }

  const { searchTerm, placesId } = JSON.parse(input.body);

  // todo sarah do real validation :)

  return {
    searchTerm,
    placesId,
    secrets: input.secrets,
  };
}
