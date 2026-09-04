import { GetPatientNotesInput } from 'utils/lib/types/api/patient-notes/patient-notes.types';
import { MISSING_REQUEST_BODY } from 'utils/lib/types/errors';
import { z } from 'zod';
import { ZambdaInput } from '../../../shared/types/common';
import { safeJsonParse, safeValidate } from '../../../shared/validation';

const GetPatientNotesSchema = z.object({
  patientId: z.string().uuid(),
  offset: z.number().int().min(0).default(0),
  pageSize: z.number().int().min(1).max(100).default(20),
});

export function validateRequestParameters(
  input: ZambdaInput
): Required<GetPatientNotesInput> & Pick<ZambdaInput, 'secrets'> {
  if (!input.body) throw MISSING_REQUEST_BODY;

  const parsedJSON = safeJsonParse(input.body);
  const { patientId, offset, pageSize } = safeValidate(GetPatientNotesSchema, parsedJSON);

  return { patientId, offset, pageSize, secrets: input.secrets };
}
