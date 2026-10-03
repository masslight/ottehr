import { DateTime } from 'luxon';
import { isPhoneNumberValid } from 'utils/lib/helpers/helpers';
import { Secrets } from 'utils/lib/secrets';
import { PersonSex } from 'utils/lib/types/common';
import { MISSING_AUTH_TOKEN, MISSING_REQUEST_BODY, MISSING_REQUEST_SECRETS } from 'utils/lib/types/errors';
import { z } from 'zod';
import { validateJsonBody } from '../../shared/helpers';
import { ZambdaInput } from '../../shared/types/common';
import { safeValidate } from '../../shared/validation';

// The same patient details, and the same checks, as a new patient on create-appointment.
export const CreatePatientInputSchema = z.object({
  patient: z.object({
    firstName: z.string().trim().min(1),
    middleName: z.string().trim().optional(),
    lastName: z.string().trim().min(1),
    dateOfBirth: z.string().refine((value) => DateTime.fromISO(value).isValid, 'must be a valid date'),
    sex: z.nativeEnum(PersonSex),
    // The account holder's number: any format formatPhoneNumber can normalize.
    phoneNumber: z
      .string()
      .refine((value) => isPhoneNumberValid(value.replace(/[^0-9+]/g, '')), 'must be a valid phone number'),
  }),
});

export type CreatePatientInputValidated = z.infer<typeof CreatePatientInputSchema> & { secrets: Secrets | null };

export function validateRequestParameters(input: ZambdaInput): CreatePatientInputValidated {
  if (!input.headers?.Authorization) throw MISSING_AUTH_TOKEN;
  if (!input.secrets) throw MISSING_REQUEST_SECRETS;
  if (!input.body) throw MISSING_REQUEST_BODY;

  const data = safeValidate(CreatePatientInputSchema, validateJsonBody(input));
  return { ...data, secrets: input.secrets };
}
