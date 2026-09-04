import { GetPatientNotesCountInput } from 'utils/lib/types/api/patient-notes/patient-notes.types';
import { MISSING_REQUEST_BODY } from 'utils/lib/types/errors';
import { z } from 'zod';
import { ZambdaInput } from '../../../shared/types/common';
import { safeJsonParse, safeValidate } from '../../../shared/validation';

const GetPatientNotesCountSchema = z.object({
  patientId: z.string().uuid(),
});

export function validateRequestParameters(
  input: ZambdaInput
): GetPatientNotesCountInput & Pick<ZambdaInput, 'secrets'> {
  if (!input.body) throw MISSING_REQUEST_BODY;

  const parsedJSON = safeJsonParse(input.body);
  const { patientId } = safeValidate(GetPatientNotesCountSchema, parsedJSON);

  return { patientId, secrets: input.secrets };
}
