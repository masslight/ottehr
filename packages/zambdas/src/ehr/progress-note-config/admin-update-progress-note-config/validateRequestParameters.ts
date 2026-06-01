import {
  MISSING_REQUEST_BODY,
  UpdateProgressNoteConfigInputSchema,
  UpdateProgressNoteConfigInputValidated,
} from 'utils';
import { safeValidate, ZambdaInput } from '../../../shared';

export function validateRequestParameters(input: ZambdaInput): UpdateProgressNoteConfigInputValidated {
  if (!input.body) {
    throw MISSING_REQUEST_BODY;
  }

  const data = safeValidate(UpdateProgressNoteConfigInputSchema, JSON.parse(input.body));

  return { ...data, secrets: input.secrets };
}
