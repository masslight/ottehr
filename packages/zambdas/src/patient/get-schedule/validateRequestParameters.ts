import { GetScheduleRequestParams } from 'utils';
import { ZambdaInput } from 'zambda-utils';
import { Secrets } from 'zambda-utils';

export const SCHEDULE_TYPES = ['location', 'provider', 'group'];
export function validateRequestParameters(input: ZambdaInput): GetScheduleRequestParams & { secrets: Secrets | null } {
  if (!input.body) {
    throw new Error('No request body provided');
  }

  const { slug, scheduleType } = JSON.parse(input.body);
  if (!slug) {
    throw new Error('slug is not found and is required');
  }

  if (!SCHEDULE_TYPES.includes(scheduleType)) {
    throw new Error(`scheduleType must be either ${SCHEDULE_TYPES}`);
  }

  return {
    slug,
    scheduleType,
    secrets: input.secrets,
  };
}
