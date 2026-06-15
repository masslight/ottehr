import { AppointmentTypeOptions, MISSING_REQUEST_BODY, ServiceMode } from 'utils';
import { z } from 'zod';
import { safeValidate, ZambdaInput } from '../../shared';
import { GetAppointmentsZambdaInputValidated } from '.';

const visitTypeOptions = Object.values(ServiceMode).flatMap((mode) =>
  AppointmentTypeOptions.map((type) => `${mode}-${type}`)
) as [string, ...string[]];

const GetAppointmentsBodySchema = z
  .object({
    searchDate: z.string().date().optional(),
    searchDateFrom: z.string().date().optional(),
    searchDateTo: z.string().date().optional(),
    timezone: z.string(),
    locationIds: z.array(z.string().uuid()).optional(),
    providerIds: z.array(z.string().uuid()).optional(),
    serviceCategories: z.array(z.string()).optional(),
    visitType: z.array(z.enum(visitTypeOptions)),
    supervisorApprovalEnabled: z.boolean().default(false),
  })
  .superRefine((data, ctx) => {
    const hasLegacyDate = Boolean(data.searchDate);
    const hasDateFrom = Boolean(data.searchDateFrom);
    const hasDateTo = Boolean(data.searchDateTo);

    if (!hasLegacyDate && !hasDateFrom && !hasDateTo) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['searchDateFrom'],
        message: 'Either "searchDate" or both "searchDateFrom" and "searchDateTo" are required',
      });
      return;
    }

    if ((hasDateFrom && !hasDateTo) || (!hasDateFrom && hasDateTo)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: hasDateFrom ? ['searchDateTo'] : ['searchDateFrom'],
        message: 'Both "searchDateFrom" and "searchDateTo" are required together',
      });
      return;
    }

    if (hasDateFrom && hasDateTo && data.searchDateFrom! > data.searchDateTo!) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['searchDateTo'],
        message: '"searchDateFrom" must be on or before "searchDateTo"',
      });
    }
  })
  .transform((data) => {
    const searchDateFrom = data.searchDateFrom ?? data.searchDate!;
    const searchDateTo = data.searchDateTo ?? data.searchDate!;

    return {
      ...data,
      searchDateFrom,
      searchDateTo,
    };
  })
  .refine((data) => data.locationIds || data.providerIds || data.serviceCategories, {
    message: 'Either "locationIds" or "providerIds" or "serviceCategories" is required',
  });

export function validateRequestParameters(input: ZambdaInput): GetAppointmentsZambdaInputValidated {
  if (!input.body) {
    throw MISSING_REQUEST_BODY;
  }

  const {
    searchDateFrom,
    searchDateTo,
    timezone,
    locationIds,
    providerIds,
    serviceCategories,
    visitType,
    supervisorApprovalEnabled,
  } = safeValidate(GetAppointmentsBodySchema, JSON.parse(input.body));

  return {
    searchDateFrom: searchDateFrom!,
    searchDateTo: searchDateTo!,
    timezone,
    locationIds,
    providerIds,
    serviceCategories,
    visitType,
    supervisorApprovalEnabled: supervisorApprovalEnabled ?? false,
    secrets: input.secrets,
  };
}
