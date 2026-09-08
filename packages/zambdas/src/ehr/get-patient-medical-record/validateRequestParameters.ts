import { Secrets } from 'utils/lib/secrets';
import {
  GetMedicalRecordExportStatusInputSchema,
  StartMedicalRecordExportInputSchema,
} from 'utils/lib/types/data/get-patient-medical-record.types';
import { MISSING_REQUEST_BODY, MISSING_REQUEST_SECRETS } from 'utils/lib/types/errors';
import { z } from 'zod';
import { ZambdaInput } from '../../shared/types/common';
import { safeValidate } from '../../shared/validation';

// Two modes on one zambda, the same shape as adhoc-report: `{ patientId }` starts (or re-attaches to)
// an export, `{ taskId }` polls one. Keeping them on one endpoint avoids a second zambda name in the
// roles/apps config for what is really one feature.
const GetPatientMedicalRecordSchema = z.union([
  GetMedicalRecordExportStatusInputSchema,
  StartMedicalRecordExportInputSchema,
]);

export type ValidatedGetPatientMedicalRecordInput = z.infer<typeof GetPatientMedicalRecordSchema> & {
  secrets: Secrets;
};

export function validateRequestParameters(input: ZambdaInput): ValidatedGetPatientMedicalRecordInput {
  if (!input.secrets) {
    throw MISSING_REQUEST_SECRETS;
  }

  if (!input.body) {
    throw MISSING_REQUEST_BODY;
  }

  const parsed = JSON.parse(input.body) as unknown;
  const validated = safeValidate(GetPatientMedicalRecordSchema, parsed);

  return { ...validated, secrets: input.secrets };
}
