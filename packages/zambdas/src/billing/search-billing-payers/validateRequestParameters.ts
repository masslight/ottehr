import { SearchBillingPayersInput, SearchBillingPayersInputSchema } from 'utils/lib/types/data/billing/billing.schemas';
import { INVALID_INPUT_ERROR, MISSING_REQUEST_SECRETS } from 'utils/lib/types/errors';
import { z } from 'zod';
import { validateJsonBody } from '../../shared/helpers';
import { ZambdaInput } from '../../shared/types/common';
import { safeJsonParse, safeValidate } from '../../shared/validation';

const SearchCursorSchema = z.object({
  query: z.string(),
  nameCursor: z.string().min(1).nullable(),
  idCursor: z.string().min(1).nullable(),
});

export interface SearchBillingPayersParams extends SearchBillingPayersInput {
  secrets: ZambdaInput['secrets'];
  searchCursor?: z.infer<typeof SearchCursorSchema>;
}

export function validateRequestParameters(input: ZambdaInput): SearchBillingPayersParams {
  if (!input.secrets) throw MISSING_REQUEST_SECRETS;
  if (!input.body) return { secrets: input.secrets };

  const data = safeValidate(SearchBillingPayersInputSchema, validateJsonBody(input));
  const searchCursor =
    !data.payerId && data.name && data.cursor
      ? safeValidate(SearchCursorSchema, safeJsonParse(data.cursor))
      : undefined;
  if (searchCursor && searchCursor.query !== data.name) {
    throw INVALID_INPUT_ERROR('Payer search cursor does not match the search query');
  }

  return {
    ...data,
    searchCursor,
    secrets: input.secrets,
  };
}
