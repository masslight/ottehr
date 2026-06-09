import {
  MISSING_REQUEST_BODY,
  MISSING_REQUEST_SECRETS,
  TagEncounterErxSyncedInput,
  TagEncounterErxSyncedInputSchema,
} from 'utils';
import { safeValidate, ZambdaInput } from '../../shared';

export function validateRequestParameters(
  input: ZambdaInput
): TagEncounterErxSyncedInput & Pick<ZambdaInput, 'secrets'> {
  if (!input.body) throw MISSING_REQUEST_BODY;
  if (!input.secrets) throw MISSING_REQUEST_SECRETS;

  const parsedInput = safeValidate(TagEncounterErxSyncedInputSchema, JSON.parse(input.body) as unknown);

  return {
    ...parsedInput,
    secrets: input.secrets,
  };
}
