import { CreateNoteInput, CreateNoteRequest } from 'utils/lib/types/api/patient-notes/patient-notes.types';
import { MISSING_AUTH_TOKEN, MISSING_REQUEST_BODY } from 'utils/lib/types/errors';
import { z } from 'zod';
import { ZambdaInput } from '../../../shared/types/common';
import { safeJsonParse, safeValidate } from '../../../shared/validation';

const CreateNoteRequestSchema: z.ZodType<CreateNoteRequest> = z
  .object({
    patientId: z.string().uuid().optional(),
    taskId: z.string().uuid().optional(),
    text: z.string().min(1),
  })
  .refine((note) => !!note.patientId !== !!note.taskId, { message: 'Exactly one of patientId or taskId is required' });

const CreateNoteSchema = z.object({ note: CreateNoteRequestSchema });

export function validateRequestParameters(
  input: ZambdaInput
): CreateNoteInput & Pick<ZambdaInput, 'secrets'> & { userToken: string } {
  if (!input.body) throw MISSING_REQUEST_BODY;
  if (!input.headers?.Authorization) throw MISSING_AUTH_TOKEN;

  const userToken = (input.headers.Authorization as string).replace('Bearer ', '');
  const parsedJSON = safeJsonParse(input.body);
  const { note } = safeValidate(CreateNoteSchema, parsedJSON);

  return { note, secrets: input.secrets, userToken };
}
