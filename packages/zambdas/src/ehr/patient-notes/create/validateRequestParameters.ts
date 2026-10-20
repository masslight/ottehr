import {
  CreatePatientNoteInput,
  CreatePatientNoteRequest,
} from 'utils/lib/types/api/patient-notes/patient-notes.types';
import { MISSING_AUTH_TOKEN, MISSING_REQUEST_BODY } from 'utils/lib/types/errors';
import { z } from 'zod';
import { ZambdaInput } from '../../../shared/types/common';
import { safeJsonParse, safeValidate } from '../../../shared/validation';

const CreatePatientNoteRequestSchema: z.ZodType<CreatePatientNoteRequest> = z.object({
  patientId: z.string().uuid(),
  text: z.string().min(1),
});

const CreatePatientNoteSchema = z.object({ note: CreatePatientNoteRequestSchema });

export function validateRequestParameters(
  input: ZambdaInput
): CreatePatientNoteInput & Pick<ZambdaInput, 'secrets'> & { userToken: string } {
  if (!input.body) throw MISSING_REQUEST_BODY;
  if (!input.headers?.Authorization) throw MISSING_AUTH_TOKEN;

  const userToken = (input.headers.Authorization as string).replace('Bearer ', '');
  const parsedJSON = safeJsonParse(input.body);
  const { note } = safeValidate(CreatePatientNoteSchema, parsedJSON);

  return { note, secrets: input.secrets, userToken };
}
