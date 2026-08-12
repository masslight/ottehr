import { Coding } from 'fhir/r4b';
import { SERVICE_CATEGORY_SYSTEM } from 'utils/lib/fhir/constants';
import { Secrets } from 'utils/lib/secrets';
import {
  UpdateVisitDetailsRequest,
  UpdateVisitDetailsRequestSchema,
} from 'utils/lib/types/api/update-visit-details.types';
import { INVALID_INPUT_ERROR, MISSING_REQUEST_BODY, NOT_AUTHORIZED } from 'utils/lib/types/errors';
import { ZambdaInput } from '../../../shared/types/common';
import { safeValidate } from '../../../shared/validation';

export interface UpdateVisitDetailsValidatedInput extends Omit<UpdateVisitDetailsRequest, 'bookingDetails'> {
  secrets: Secrets | null;
  userToken: string;
  bookingDetails: Omit<UpdateVisitDetailsRequest['bookingDetails'], 'serviceCategory'> & {
    serviceCategory?: Coding;
  };
}

export const validateRequestParameters = (input: ZambdaInput): UpdateVisitDetailsValidatedInput => {
  if (!input.body) {
    throw MISSING_REQUEST_BODY;
  }

  const userToken = input.headers.Authorization?.replace('Bearer ', '');
  if (!userToken) {
    throw NOT_AUTHORIZED;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(input.body);
  } catch {
    throw INVALID_INPUT_ERROR('request body must be valid JSON');
  }

  const request = safeValidate(UpdateVisitDetailsRequestSchema, parsed);

  const { serviceCategory, ...restBookingDetails } = request.bookingDetails;

  const serviceCategoryCoding: Coding | undefined = serviceCategory
    ? { system: SERVICE_CATEGORY_SYSTEM, code: serviceCategory }
    : undefined;

  return {
    ...request,
    bookingDetails: { ...restBookingDetails, serviceCategory: serviceCategoryCoding },
    secrets: input.secrets,
    userToken,
  };
};
