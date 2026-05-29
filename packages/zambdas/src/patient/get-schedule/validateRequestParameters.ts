import {
  GetScheduleRequestParams,
  getServiceCategoryCodeSchema,
  INVALID_INPUT_ERROR,
  MISSING_REQUEST_BODY,
  ScheduleType,
  Secrets,
  ServiceCategoryCode,
} from 'utils';
import { z } from 'zod';
import { safeValidate, ZambdaInput } from '../../shared';

export const SCHEDULE_TYPES = ['location', 'provider', 'group'] as const;

const GetScheduleBodySchema = z.object({
  slug: z.string().min(1),
  scheduleType: z.enum(SCHEDULE_TYPES),
  selectedDate: z.string().optional(),
  serviceCategoryCode: z.string().optional(),
});

export function validateRequestParameters(input: ZambdaInput): GetScheduleRequestParams & { secrets: Secrets | null } {
  if (!input.body) {
    throw MISSING_REQUEST_BODY;
  }

  const {
    slug,
    scheduleType,
    selectedDate,
    serviceCategoryCode: maybeServiceCategoryCode,
  } = safeValidate(GetScheduleBodySchema, JSON.parse(input.body));

  let serviceCategoryCode: ServiceCategoryCode | undefined;

  if (maybeServiceCategoryCode) {
    const categorySchema = getServiceCategoryCodeSchema();
    serviceCategoryCode = categorySchema.safeParse(maybeServiceCategoryCode).data;
    if (!serviceCategoryCode) {
      throw INVALID_INPUT_ERROR(`"serviceCategoryCode" must be one of ${categorySchema.options.join(', ')}`);
    }
  }

  return {
    slug,
    scheduleType: scheduleType as ScheduleType,
    secrets: input.secrets,
    selectedDate,
    serviceCategoryCode,
  };
}
