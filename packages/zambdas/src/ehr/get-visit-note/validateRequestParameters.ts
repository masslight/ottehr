import { GetVisitNoteRequest } from 'utils/lib/types/api/chart-data/get-visit-note.types';
import { MISSING_REQUEST_BODY } from 'utils/lib/types/errors';
import { z } from 'zod';
import { ZambdaInput } from '../../shared/types/common';
import { safeJsonParse, safeValidate } from '../../shared/validation';

const GetVisitNoteSchema = z.object({ encounterId: z.string().uuid() }).strict();

export function validateRequestParameters(input: ZambdaInput): GetVisitNoteRequest & Pick<ZambdaInput, 'secrets'> {
  if (!input.body) {
    throw MISSING_REQUEST_BODY;
  }
  const { encounterId } = safeValidate(GetVisitNoteSchema, safeJsonParse(input.body));
  return { encounterId, secrets: input.secrets };
}
