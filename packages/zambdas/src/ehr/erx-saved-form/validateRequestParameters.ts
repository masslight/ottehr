import { ErxSavedFormInput, ErxSavedFormInputSchema } from 'utils/lib/types/api/erx.types';
import { INVALID_INPUT_ERROR } from 'utils/lib/types/errors';
import { ZambdaInput } from '../../shared/types/common';
import { validateWithSchema } from '../../shared/validation';

// A drug's strength list makes a line a few kB; 20 lines stay far under this.
export const ERX_SAVED_FORM_MAX_BODY_LENGTH = 1_000_000;

export function validateRequestParameters(input: ZambdaInput): ErxSavedFormInput & Pick<ZambdaInput, 'secrets'> {
  if (input.body && input.body.length > ERX_SAVED_FORM_MAX_BODY_LENGTH) {
    throw INVALID_INPUT_ERROR('The form is too large to save');
  }
  return validateWithSchema(ErxSavedFormInputSchema, input);
}
