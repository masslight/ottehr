import { UpdateApprovedPatientEducationCodesInput } from 'utils';
import { ZambdaInput } from '../../shared';

export function validateRequestParameters(
  input: ZambdaInput
): UpdateApprovedPatientEducationCodesInput & Pick<ZambdaInput, 'secrets'> {
  if (!input.body) throw new Error('No request body provided');
  const { documentReferenceId, icdCodes } = JSON.parse(input.body) as Partial<UpdateApprovedPatientEducationCodesInput>;
  if (!documentReferenceId) throw new Error('documentReferenceId is required');
  if (!icdCodes || !Array.isArray(icdCodes) || icdCodes.length === 0) {
    throw new Error('icdCodes is required and must be a non-empty array');
  }
  for (const c of icdCodes) {
    if (!c?.code) throw new Error('Each icdCode must have a code');
  }
  return { documentReferenceId, icdCodes, secrets: input.secrets };
}
