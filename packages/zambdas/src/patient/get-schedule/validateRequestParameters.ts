import {
  GetScheduleRequestParams,
  INVALID_INPUT_ERROR,
  MISSING_REQUEST_BODY,
  MISSING_REQUIRED_PARAMETERS,
  Secrets,
  ServiceCategoryCode,
  ServiceCategoryCodeSchema,
} from 'utils';
import { ZambdaInput } from '../../shared';

export const SCHEDULE_TYPES = ['location', 'provider', 'group'];
export function validateRequestParameters(input: ZambdaInput): GetScheduleRequestParams & { secrets: Secrets | null } {
  if (!input.body) {
    throw MISSING_REQUEST_BODY;
  }

  const { slug, scheduleType, selectedDate, serviceCategoryCode: maybeServiceCategoryCode } = JSON.parse(input.body);
  if (!slug) {
    throw MISSING_REQUIRED_PARAMETERS(['slug']);
  }

  if (!SCHEDULE_TYPES.includes(scheduleType)) {
    throw INVALID_INPUT_ERROR(`scheduleType must be either ${SCHEDULE_TYPES}`);
  }

  console.log('SERVICE CATEGORIES FOR SLOT GENERATION maybe:', maybeServiceCategoryCode);

  let serviceCategoryCode: ServiceCategoryCode | undefined;

  if (maybeServiceCategoryCode) {
    serviceCategoryCode = ServiceCategoryCodeSchema.safeParse(maybeServiceCategoryCode).data;
    if (!serviceCategoryCode) {
      throw INVALID_INPUT_ERROR(`"serviceCategoryCode" must be one of ${ServiceCategoryCodeSchema.options.join(', ')}`);
    }
  }

  return {
    slug,
    scheduleType,
    secrets: input.secrets,
    selectedDate,
    serviceCategoryCode,
  };
}
