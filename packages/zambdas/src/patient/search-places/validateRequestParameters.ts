import { INVALID_INPUT_ERROR, MISSING_REQUEST_BODY, SearchPlacesInput, Secrets } from 'utils';
import { ZambdaInput } from '../../shared';

export function validateRequestParameters(input: ZambdaInput): SearchPlacesInput & { secrets: Secrets | null } {
  if (!input.body) {
    throw MISSING_REQUEST_BODY;
  }

  const { searchTerm, placesId } = JSON.parse(input.body);

  if (!searchTerm && !placesId) {
    throw INVALID_INPUT_ERROR('searchTerm or placesId must be sent');
  }

  if (searchTerm && placesId) {
    throw INVALID_INPUT_ERROR('Please send either searchTerm or placesId, only one param should be sent.');
  }

  if (searchTerm && typeof searchTerm !== 'string') {
    throw INVALID_INPUT_ERROR('Invalid parameter: searchTerm should be a string');
  }

  if (placesId && typeof placesId !== 'string') {
    throw INVALID_INPUT_ERROR('Invalid parameter: placesId should be a string');
  }

  return {
    searchTerm,
    placesId,
    secrets: input.secrets,
  };
}
