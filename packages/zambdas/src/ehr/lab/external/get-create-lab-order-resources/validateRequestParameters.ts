import { GetCreateLabOrderResources } from 'utils';
import { ZambdaInput } from '../../../../shared';

export function validateRequestParameters(input: ZambdaInput): GetCreateLabOrderResources & { secrets: any } {
  if (!input.body) {
    throw new Error('No request body provided');
  }

  const { patientId, encounterId, search, labOrgIdsString, selectedLabSet } = JSON.parse(input.body);

  if (!patientId && !search && !selectedLabSet) {
    throw new Error('One of the following must be passed as a parameter: patientId, search, selectedLabSet');
  }

  if (search && selectedLabSet) {
    throw new Error('Please pass either a search test or a selectedLabSet, not both');
  }

  return {
    patientId,
    encounterId,
    search,
    labOrgIdsString,
    selectedLabSet,
    secrets: input.secrets,
  };
}
