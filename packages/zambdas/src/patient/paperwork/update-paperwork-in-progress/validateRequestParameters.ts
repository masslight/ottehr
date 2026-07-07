import { DateTime } from 'luxon';
import { MISSING_REQUEST_BODY } from 'utils';
import { z } from 'zod';
import { safeJsonParse, safeValidate, ZambdaInput } from '../../../shared';

interface UpdatePaperworkInProgressParams {
  appointmentID: string;
  inProgress: string;
}

const UpdatePaperworkInProgressBodySchema = z.object({
  appointmentID: z.string().uuid(),
  inProgress: z.string().min(1),
});

export function validateUpdatePaperworkParams(input: ZambdaInput): UpdatePaperworkInProgressParams {
  if (!input.body) {
    throw MISSING_REQUEST_BODY;
  }

  const inputJSON = safeJsonParse(input.body);
  console.log('inputJSON', JSON.stringify(inputJSON));
  const { appointmentID, inProgress } = safeValidate(UpdatePaperworkInProgressBodySchema, inputJSON);

  if (!DateTime.fromISO(inProgress).isValid) {
    throw new Error('Paperwork in progress update must supply a valid iso string for inProgress param');
  }

  return {
    appointmentID,
    inProgress,
  };
}
