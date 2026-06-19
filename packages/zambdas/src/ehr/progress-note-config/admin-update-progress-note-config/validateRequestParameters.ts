import {
  MISSING_AUTH_TOKEN,
  MISSING_REQUEST_BODY,
  UpdateProgressNoteConfigInputSchema,
  UpdateProgressNoteConfigInputValidated,
} from 'utils';
import { safeValidate, ZambdaInput } from '../../../shared';

export function validateRequestParameters(input: ZambdaInput): UpdateProgressNoteConfigInputValidated {
  if (!input.body) {
    throw MISSING_REQUEST_BODY;
  }

  const authHeader = input.headers?.Authorization;
  if (!authHeader) {
    throw MISSING_AUTH_TOKEN;
  }

  const userToken = authHeader.replace('Bearer ', '');

  const data = safeValidate(UpdateProgressNoteConfigInputSchema, JSON.parse(input.body));

  return {
    ...data,
    // `safeValidate`'s ZodSchema<T> collapses the schema's input/output types, which leaks the
    // optionality of the `.default()`. The default is already applied at parse time, so this just
    // satisfies the (required) output type.
    vitalsUnitInputOrder: data.vitalsUnitInputOrder ?? 'metric-imperial',
    secrets: input.secrets,
    userToken,
  };
}
