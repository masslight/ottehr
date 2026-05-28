import { z } from 'zod';
import { safeValidate, ZambdaInput } from '../../shared';
import { GetAppointmentsZambdaInputValidated } from '.';

const GetAppointmentsBodySchema = z
  .object({
    searchDate: z.string(),
    timezone: z.string(),
    locationIds: z.array(z.string()).optional(),
    providerIds: z.array(z.string()).optional(),
    serviceCategories: z.array(z.string()).optional(),
    visitType: z.array(z.string()),
    supervisorApprovalEnabled: z.boolean().default(false),
  })
  .refine((data) => data.locationIds || data.providerIds || data.serviceCategories, {
    message: 'Either "locationIds" or "providerIds" or "serviceCategories" is required',
  });

export function validateRequestParameters(input: ZambdaInput): GetAppointmentsZambdaInputValidated {
  if (!input.body) {
    throw new Error('No request body provided');
  }

  const { searchDate, timezone, locationIds, providerIds, serviceCategories, visitType, supervisorApprovalEnabled } =
    safeValidate(GetAppointmentsBodySchema, JSON.parse(input.body));

  return {
    searchDate,
    timezone,
    locationIds,
    providerIds,
    serviceCategories,
    visitType,
    supervisorApprovalEnabled,
    secrets: input.secrets,
  };
}
