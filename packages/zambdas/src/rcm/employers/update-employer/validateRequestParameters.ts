import { MISSING_REQUEST_BODY } from 'utils';
import { z } from 'zod';
import { safeJsonParse, safeValidate, ZambdaInput } from '../../../shared';
import { EmployerAddressInput, EmployerContactInput, EmployerIdentifierInput } from '../helpers';

export interface UpdateEmployerParams {
  employerId: string;
  name?: string;
  active?: boolean;
  category?: string;
  identifier?: EmployerIdentifierInput | null;
  address?: EmployerAddressInput | null;
  contact?: EmployerContactInput | null;
  secrets: ZambdaInput['secrets'];
}

const UpdateEmployerBodySchema = z.object({
  employerId: z.string().uuid(),
  name: z.string().min(1).optional(),
  active: z.boolean().optional(),
  category: z.string().min(1).optional(),
  identifier: z
    .object({
      system: z.string().optional(),
      value: z.string().min(1),
    })
    .nullable()
    .optional(),
  address: z
    .object({
      line: z.array(z.string()).optional(),
      city: z.string().optional(),
      state: z.string().optional(),
      postalCode: z.string().optional(),
      country: z.string().optional(),
    })
    .nullable()
    .optional(),
  contact: z
    .object({
      phone: z.string().optional(),
      fax: z.string().optional(),
      email: z.string().optional(),
      notes: z.string().optional(),
    })
    .nullable()
    .optional(),
});

export function validateRequestParameters(input: ZambdaInput): UpdateEmployerParams {
  if (!input.body) {
    throw MISSING_REQUEST_BODY;
  }

  const { employerId, name, active, category, identifier, address, contact } = safeValidate(
    UpdateEmployerBodySchema,
    safeJsonParse(input.body)
  );

  return {
    employerId,
    name,
    active,
    category,
    identifier: identifier as EmployerIdentifierInput | null | undefined,
    address: address as EmployerAddressInput | null | undefined,
    contact: contact as EmployerContactInput | null | undefined,
    secrets: input.secrets,
  };
}
