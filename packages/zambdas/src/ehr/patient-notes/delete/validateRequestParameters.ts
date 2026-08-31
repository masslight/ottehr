import { DeletePatientNoteInput } from 'utils/lib/types/api/patient-notes/patient-notes.types';
import { MISSING_REQUEST_BODY } from 'utils/lib/types/errors';
import { z } from 'zod';
import { ZambdaInput } from '../../../shared/types/common';
import { safeJsonParse, safeValidate } from '../../../shared/validation';

const DeletePatientNoteSchema = z.object({
  resourceId: z.string().uuid(),
});

export function validateRequestParameters(input: ZambdaInput): DeletePatientNoteInput & Pick<ZambdaInput, 'secrets'> {
  if (!input.body) {
    throw MISSING_REQUEST_BODY;
  }

  const parsedJSON = safeJsonParse(input.body);
  const { resourceId } = safeValidate(DeletePatientNoteSchema, parsedJSON);

  return { resourceId, secrets: input.secrets };
}
