import { PendingSupervisorApprovalInputSchema, PendingSupervisorApprovalInputValidated } from 'utils';
import { safeJsonParse, safeValidate, ZambdaInput } from '../../shared';

export function validateRequestParameters(input: ZambdaInput): PendingSupervisorApprovalInputValidated {
  console.group('validateRequestParameters');

  if (!input.body) {
    throw new Error('No request body provided');
  }

  const parsedJSON = safeJsonParse(input.body) as unknown;

  const { encounterId, practitionerId } = safeValidate(PendingSupervisorApprovalInputSchema, parsedJSON);

  console.groupEnd();
  console.debug('validateRequestParameters success');

  return {
    encounterId,
    practitionerId,
    secrets: input.secrets,
  };
}
