import {
  DEFAULT_VITALS_UNIT_INPUT_ORDER,
  UpdateProgressNoteConfigInputSchema,
  UpdateProgressNoteConfigInputValidated,
} from 'utils/lib/types/api/progress-note-config/progress-note-config.types';
import { MISSING_AUTH_TOKEN, MISSING_REQUEST_BODY } from 'utils/lib/types/errors';
import { ZambdaInput } from '../../../shared/types/common';
import { safeJsonParse, safeValidate } from '../../../shared/validation';

export function validateRequestParameters(input: ZambdaInput): UpdateProgressNoteConfigInputValidated {
  if (!input.body) {
    throw MISSING_REQUEST_BODY;
  }

  const authHeader = input.headers?.Authorization;
  if (!authHeader) {
    throw MISSING_AUTH_TOKEN;
  }

  const userToken = authHeader.replace('Bearer ', '');

  const data = safeValidate(UpdateProgressNoteConfigInputSchema, safeJsonParse(input.body));

  return {
    ...data,
    // `safeValidate`'s ZodSchema<T> collapses the schema's input/output types, which leaks the
    // optionality of the `.default()`. The default is already applied at parse time, so this just
    // satisfies the (required) output type.
    vitalsUnitInputOrder: data.vitalsUnitInputOrder ?? DEFAULT_VITALS_UNIT_INPUT_ORDER,
    secrets: input.secrets,
    userToken,
  };
}
