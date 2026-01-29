import { GetCreateLabOrderResources } from 'utils';
import { ZambdaInput } from '../../../../shared';

export function validateRequestParameters(input: ZambdaInput): GetCreateLabOrderResources & { secrets: any } {
  if (!input.body) {
    throw new Error('No request body provided');
  }

  const { patientId, encounterId, search, labOrgIdsString } = JSON.parse(input.body);

  if (!patientId && !search) {
    throw new Error('patientId or a search value must be passed as a parameter');
  }

  return {
    patientId,
    encounterId,
    search,
    labOrgIdsString,
    secrets: input.secrets,
  };
}
