import { DeleteApprovedPatientEducationInput } from 'utils';
import { ZambdaInput } from '../../shared';

export function validateRequestParameters(
  input: ZambdaInput
): DeleteApprovedPatientEducationInput & Pick<ZambdaInput, 'secrets'> {
  if (!input.body) throw new Error('No request body provided');
  const { documentReferenceId } = JSON.parse(input.body) as Partial<DeleteApprovedPatientEducationInput>;
  if (!documentReferenceId) throw new Error('documentReferenceId is required');
  return { documentReferenceId, secrets: input.secrets };
}
