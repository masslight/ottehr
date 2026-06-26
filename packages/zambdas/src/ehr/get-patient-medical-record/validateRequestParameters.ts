import { GetPatientMedicalRecordInput, MISSING_REQUEST_BODY, MISSING_REQUEST_SECRETS } from 'utils';
import { z } from 'zod';
import { safeValidate, ZambdaInput } from '../../shared';

const GetPatientMedicalRecordSchema = z.object({
  patientId: z.string().uuid(),
});

export function validateRequestParameters(
  input: ZambdaInput
): GetPatientMedicalRecordInput & Pick<ZambdaInput, 'secrets'> {
  if (!input.secrets) {
    throw MISSING_REQUEST_SECRETS;
  }

  if (!input.body) {
    throw MISSING_REQUEST_BODY;
  }

  const parsed = JSON.parse(input.body) as unknown;
  const { patientId } = safeValidate(GetPatientMedicalRecordSchema, parsed);

  return {
    patientId,
    secrets: input.secrets,
  };
}
