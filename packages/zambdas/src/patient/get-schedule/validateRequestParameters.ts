import {
  GetScheduleRequestParams,
  getServiceCategoryCodeSchema,
  INVALID_INPUT_ERROR,
  MISSING_REQUEST_BODY,
  MISSING_REQUIRED_PARAMETERS,
  Secrets,
  ServiceCategoryCode,
} from 'utils';
import { ZambdaInput } from '../../shared';

export const SCHEDULE_TYPES = ['location', 'provider', 'group'];
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
  } = JSON.parse(input.body);
  if (!slug) {
    throw MISSING_REQUIRED_PARAMETERS(['slug']);
  }

  if (!SCHEDULE_TYPES.includes(scheduleType)) {
    throw INVALID_INPUT_ERROR(`scheduleType must be either ${SCHEDULE_TYPES}`);
  }

  if (atLocationSlug != null && typeof atLocationSlug !== 'string') {
    throw INVALID_INPUT_ERROR('"atLocationSlug" must be a string if provided');
  }

  console.log('SERVICE CATEGORIES FOR SLOT GENERATION maybe:', maybeServiceCategoryCode);

  let serviceCategoryCode: ServiceCategoryCode | undefined;

  if (maybeServiceCategoryCode) {
    const schema = getServiceCategoryCodeSchema();
    serviceCategoryCode = schema.safeParse(maybeServiceCategoryCode).data;
    if (!serviceCategoryCode) {
      throw INVALID_INPUT_ERROR('"serviceCategoryCode" must be a URL-safe slug (1-64 chars, letters/digits/hyphens)');
    }
  }

  return {
    slug,
    scheduleType,
    secrets: input.secrets,
    selectedDate,
    serviceCategoryCode,
    atLocationSlug,
  };
}
