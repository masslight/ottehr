import { getAppointmentSearchDateRangeError } from 'utils/lib/helpers/appointment-search';
import { AppointmentTypeOptions } from 'utils/lib/types/api/appointment.types';
import { ServiceMode } from 'utils/lib/types/common';
import { MISSING_REQUEST_BODY } from 'utils/lib/types/errors';
import { z } from 'zod';
import { ZambdaInput } from '../../shared/types/common';
import { safeValidate } from '../../shared/validation';
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
    const rangeError = getAppointmentSearchDateRangeError(data.searchDateFrom, data.searchDateTo);
    if (rangeError) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['searchDateTo'], message: rangeError });
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
