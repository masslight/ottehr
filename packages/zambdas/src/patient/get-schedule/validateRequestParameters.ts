import {
  GetScheduleRequestParams,
  getServiceCategoryCodeSchema,
  INVALID_INPUT_ERROR,
  MISSING_REQUEST_BODY,
  ScheduleType,
  Secrets,
  ServiceCategoryCode,
  ServiceMode,
  SLUG_REGEX,
  SLUG_VALIDATION_MESSAGE,
} from 'utils';
import { z } from 'zod';
import { safeJsonParse, safeValidate, ZambdaInput } from '../../shared';

export const SCHEDULE_TYPES = ['location', 'provider', 'group'] as const;

// Slug fields are interpolated raw into FHIR `identifier` search params as
// `${SLUG_SYSTEM}|${slug}`. Without a format guard, a caller can include `|`
// (or other special chars) to break out of the value side and inject extra
// search clauses. Restrict to URL-safe slug shape: letters/digits/hyphens.
const SlugSchema = z.string().regex(SLUG_REGEX, SLUG_VALIDATION_MESSAGE);

const GetScheduleBodySchema = z.object({
  slug: SlugSchema.min(1),
  scheduleType: z.enum(SCHEDULE_TYPES),
  selectedDate: z.string().date().optional(),
  serviceCategoryCode: z.string().optional(),
  // Tolerant on purpose: the mode comes from a raw URL path segment. An
  // unrecognized value coerces to undefined (no mode filter) rather than 400,
  // preserving the pre-filter behavior for malformed booking links.
  serviceMode: z.nativeEnum(ServiceMode).optional().catch(undefined),
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
    serviceMode,
    atLocationSlug,
  } = safeValidate(GetScheduleBodySchema, safeJsonParse(input.body));

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
    serviceMode,
    atLocationSlug,
  };
}
