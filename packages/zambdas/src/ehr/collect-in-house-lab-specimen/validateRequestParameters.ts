import { CollectInHouseLabSpecimenParameters, Secrets } from 'utils';
import { ZambdaInput } from '../../shared';

export function validateRequestParameters(
  input: ZambdaInput
): CollectInHouseLabSpecimenParameters & { secrets: Secrets | null; userToken: string } {
  if (!input.body) {
    throw new Error('No request body provided');
  }

  const userToken = input.headers.Authorization.replace('Bearer ', '');
  const secrets = input.secrets;

  let params: CollectInHouseLabSpecimenParameters;

  try {
    params = JSON.parse(input.body);
  } catch {
    throw Error('Invalid JSON in request body');
  }

  if (!params.encounterId) {
    throw new Error('encounterId is required');
  }

  if (!params.serviceRequestId) {
    throw new Error('serviceRequestId is required');
  }

  if (!params.data) {
    throw new Error('data is required');
  }

  if (!params.data.specimen) {
    throw new Error('specimen is required');
  }

  if (!params.data.specimen.source) {
    throw new Error('specimen.source is required');
  }

  if (!params.data.specimen.collectedBy) {
    throw new Error('specimen.collectedBy is required');
  }

  if (!('id' in params.data.specimen.collectedBy)) {
    throw new Error('specimen.collectedBy.id is required');
  }

  if (!('name' in params.data.specimen.collectedBy)) {
    throw new Error('specimen.collectedBy.name is required');
  }

  if (!params.data.specimen.collectionDate) {
    throw new Error('specimen.collectionDate is required');
  }

  return {
    ...params,
    secrets,
    userToken,
  };
}
