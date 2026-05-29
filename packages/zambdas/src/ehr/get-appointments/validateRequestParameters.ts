import { AppointmentTypeOptions, ServiceMode } from 'utils';
import { z } from 'zod';
import { safeValidate, ZambdaInput } from '../../shared';
import { GetAppointmentsZambdaInputValidated } from '.';

const visitTypeOptions = Object.values(ServiceMode).flatMap((mode) =>
  AppointmentTypeOptions.map((type) => `${mode}-${type}`)
) as [string, ...string[]];

const GetAppointmentsBodySchema = z
  .object({
    searchDate: z.string().date(),
    timezone: z.string(),
    locationIds: z.array(z.string().uuid()).optional(),
    providerIds: z.array(z.string().uuid()).optional(),
    serviceCategories: z.array(z.string()).optional(),
    visitType: z.array(z.enum(visitTypeOptions)),
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
    supervisorApprovalEnabled: supervisorApprovalEnabled ?? false,
    secrets: input.secrets,
  };
}
