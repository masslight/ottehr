import { DateTime } from 'luxon';
import { AppointmentTypeOptions, MAX_APPOINTMENT_SEARCH_RANGE_DAYS, MISSING_REQUEST_BODY, ServiceMode } from 'utils';
import { z } from 'zod';
import { safeValidate, ZambdaInput } from '../../shared';
import { GetAppointmentsZambdaInputValidated } from '.';

const visitTypeOptions = Object.values(ServiceMode).flatMap((mode) =>
  AppointmentTypeOptions.map((type) => `${mode}-${type}`)
) as [string, ...string[]];

const GetAppointmentsBodySchema = z
  .object({
    searchDateFrom: z.string().date(),
    searchDateTo: z.string().date(),
    timezone: z.string(),
    locationIds: z.array(z.string().uuid()).optional(),
    providerIds: z.array(z.string().uuid()).optional(),
    serviceCategories: z.array(z.string()).optional(),
    visitType: z.array(z.enum(visitTypeOptions)),
    supervisorApprovalEnabled: z.boolean().default(false),
  })
  .superRefine((data, ctx) => {
    if (data.searchDateFrom > data.searchDateTo) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['searchDateTo'],
        message: '"searchDateFrom" must be on or before "searchDateTo"',
      });
      return;
    }

    // Parse in a fixed zone so every day is exactly 24h; otherwise DST transitions in the process
    // local zone produce fractional-day diffs that make the limit nondeterministic at the boundary.
    const rangeInDays = DateTime.fromISO(data.searchDateTo, { zone: 'utc' }).diff(
      DateTime.fromISO(data.searchDateFrom, { zone: 'utc' }),
      'days'
    ).days;
    if (rangeInDays > MAX_APPOINTMENT_SEARCH_RANGE_DAYS) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['searchDateTo'],
        message: `The date range must not exceed ${MAX_APPOINTMENT_SEARCH_RANGE_DAYS} days`,
      });
    }
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
    searchDateFrom,
    searchDateTo,
    timezone,
    locationIds,
    providerIds,
    serviceCategories,
    visitType,
    supervisorApprovalEnabled: supervisorApprovalEnabled ?? false,
    secrets: input.secrets,
  };
}
