import { Secrets } from 'utils/lib/secrets';
import { MISSING_AUTH_TOKEN, MISSING_REQUEST_SECRETS } from 'utils/lib/types/errors';
import { z } from 'zod';
import { validateJsonBody } from '../../shared/helpers';
import { ZambdaInput } from '../../shared/types/common';
import { safeValidate } from '../../shared/validation';

export const SearchPatientsInputSchema = z.object({
  name: z.string().trim().min(1).optional(),
  dateOfBirth: z.string().trim().min(1).optional(),
  phone: z.string().trim().min(1).optional(),
  email: z.string().trim().min(1).optional(),
  offset: z.number().int().nonnegative().optional(),
});
export type SearchPatientsInput = z.infer<typeof SearchPatientsInputSchema>;

export interface SearchPatientsInputValidated extends SearchPatientsInput {
  secrets: Secrets | null;
}

export function validateRequestParameters(input: ZambdaInput): SearchPatientsInputValidated {
  if (!input.headers?.Authorization) throw MISSING_AUTH_TOKEN;
  if (!input.secrets) throw MISSING_REQUEST_SECRETS;
  if (!input.body) return { secrets: input.secrets };

  const data = safeValidate(SearchPatientsInputSchema, validateJsonBody(input));
  return { ...data, secrets: input.secrets };
}
