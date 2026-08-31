import { GetPatientMedicalRecordInput } from 'utils/lib/types/data/get-patient-medical-record.types';
import { MISSING_REQUEST_BODY, MISSING_REQUEST_SECRETS } from 'utils/lib/types/errors';
import { z } from 'zod';
import { ZambdaInput } from '../../shared/types/common';
import { safeValidate } from '../../shared/validation';

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
