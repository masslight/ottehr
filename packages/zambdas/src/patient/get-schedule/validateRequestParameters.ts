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

// Slug fields are interpolated raw into FHIR `identifier` search params as
// `${SLUG_SYSTEM}|${slug}`. Without a format guard, a caller can include `|`
// (or other special chars) to break out of the value side and inject extra
// search clauses. Restrict to URL-safe slug shape: letters/digits/hyphens.
const SLUG_REGEX = /^[a-zA-Z0-9-]+$/;
const SlugSchema = z.string().regex(SLUG_REGEX, 'must be a URL-safe slug (letters, digits, hyphens)');

const GetScheduleBodySchema = z.object({
  slug: SlugSchema.min(1),
  scheduleType: z.enum(SCHEDULE_TYPES),
  selectedDate: z.string().date().optional(),
  serviceCategoryCode: z.string().optional(),
  atLocationSlug: SlugSchema.optional(),
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
    atLocationSlug,
  } = safeValidate(GetScheduleBodySchema, JSON.parse(input.body));

  let serviceCategoryCode: ServiceCategoryCode | undefined;

  if (maybeServiceCategoryCode) {
    const categorySchema = getServiceCategoryCodeSchema();
    serviceCategoryCode = categorySchema.safeParse(maybeServiceCategoryCode).data;
    if (!serviceCategoryCode) {
      throw INVALID_INPUT_ERROR('"serviceCategoryCode" must be a URL-safe slug (1-64 chars, letters/digits/hyphens)');
    }
  }

  return {
    slug,
    scheduleType: scheduleType as ScheduleType,
    secrets: input.secrets,
    selectedDate,
    serviceCategoryCode,
    atLocationSlug,
  };
}
