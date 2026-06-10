import { MISSING_REQUEST_BODY } from 'utils';
import { z } from 'zod';
import { safeValidate, ZambdaInput } from '../../../shared';
import { EmployerAddressInput, EmployerContactInput, EmployerIdentifierInput } from '../helpers';

export interface CreateEmployerParams {
  name: string;
  active?: boolean;
  category?: string;
  identifier?: EmployerIdentifierInput;
  address?: EmployerAddressInput;
  contact?: EmployerContactInput;
  secrets: ZambdaInput['secrets'];
}

const CreateEmployerBodySchema = z.object({
  name: z.string().min(1),
  active: z.boolean().optional(),
  category: z.string().min(1).optional(),
  identifier: z
    .object({
      system: z.string().optional(),
      value: z.string().min(1),
    })
    .optional(),
  address: z
    .object({
      line: z.array(z.string()).optional(),
      city: z.string().optional(),
      state: z.string().optional(),
      postalCode: z.string().optional(),
      country: z.string().optional(),
    })
    .optional(),
  contact: z
    .object({
      phone: z.string().optional(),
      fax: z.string().optional(),
      email: z.string().optional(),
      notes: z.string().optional(),
    })
    .optional(),
});

export function validateRequestParameters(input: ZambdaInput): CreateEmployerParams {
  if (!input.body) {
    throw MISSING_REQUEST_BODY;
  }

  const { name, active, category, identifier, address, contact } = safeValidate(
    CreateEmployerBodySchema,
    JSON.parse(input.body)
  );

  return {
    name,
    active,
    category,
    identifier: identifier as EmployerIdentifierInput | undefined,
    address: address as EmployerAddressInput | undefined,
    contact: contact as EmployerContactInput | undefined,
    secrets: input.secrets,
  };
}
