import { Coding } from 'fhir/r4b';
import {
  getServiceCategoryCodings,
  INVALID_INPUT_ERROR,
  MISSING_REQUEST_BODY,
  NOT_AUTHORIZED,
  Secrets,
  UpdateVisitDetailsRequest,
  UpdateVisitDetailsRequestSchema,
} from 'utils';
import { safeValidate, ZambdaInput } from '../../../shared';

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

  const serviceCategoryCoding = serviceCategory
    ? getServiceCategoryCodings().find((coding) => coding.code === serviceCategory)
    : undefined;

  return {
    ...request,
    bookingDetails: { ...restBookingDetails, serviceCategory: serviceCategoryCoding },
    secrets: input.secrets,
    userToken,
  };
};
