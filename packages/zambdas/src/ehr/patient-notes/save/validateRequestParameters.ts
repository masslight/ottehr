import { SavePatientNoteInput, SavePatientNoteRequest } from 'utils/lib/types/api/patient-notes/patient-notes.types';
import { MISSING_REQUEST_BODY } from 'utils/lib/types/errors';
import { z } from 'zod';
import { ZambdaInput } from '../../../shared/types/common';
import { safeJsonParse, safeValidate } from '../../../shared/validation';

const SavePatientNoteRequestSchema: z.ZodType<SavePatientNoteRequest> = z.object({
  resourceId: z.string().uuid().optional(),
  patientId: z.string().uuid(),
  text: z.string().min(1),
});

const SavePatientNoteSchema = z.object({
  note: SavePatientNoteRequestSchema,
});

export function validateRequestParameters(
  input: ZambdaInput
): SavePatientNoteInput & Pick<ZambdaInput, 'secrets'> & { userToken: string } {
  if (!input.body) {
    throw MISSING_REQUEST_BODY;
  }

  if (input.headers?.Authorization === undefined) {
    throw new Error('Authorization header is required');
  }

  const userToken = (input.headers.Authorization as string).replace('Bearer ', '');
  const parsedJSON = safeJsonParse(input.body);
  const { note } = safeValidate(SavePatientNoteSchema, parsedJSON);

  return { note, secrets: input.secrets, userToken };
}
