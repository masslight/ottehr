import { Coding } from 'fhir/r4b';
import { DateTime } from 'luxon';
import {
  BOOKING_CONFIG,
  BookingDetails,
  INVALID_INPUT_ERROR,
  MISSING_REQUEST_BODY,
  Secrets,
  UpdateVisitDetailsRequestSchema,
} from 'utils';
import { ZodError } from 'zod';
import { ZambdaInput } from '../../../shared';
import { formatZodError } from '../../../shared/validation';

export interface UpdateVisitDetailsValidatedInput {
  secrets: Secrets | null;
  userToken: string;
  appointmentId: string;
  bookingDetails: Omit<BookingDetails, 'serviceCategory'> & {
    serviceCategory?: Coding;
  };
}

export const validateRequestParameters = (input: ZambdaInput): UpdateVisitDetailsValidatedInput => {
  if (!input.body) {
    throw MISSING_REQUEST_BODY;
  }

  const userToken = input.headers.Authorization?.replace('Bearer ', '');
  if (!userToken) {
    throw new Error('user token unexpectedly missing');
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(input.body);
  } catch {
    throw INVALID_INPUT_ERROR('request body must be valid JSON');
  }

  let request: ReturnType<typeof UpdateVisitDetailsRequestSchema.parse>;
  try {
    request = UpdateVisitDetailsRequestSchema.parse(parsed);
  } catch (err) {
    if (err instanceof ZodError) {
      throw INVALID_INPUT_ERROR(formatZodError(err));
    }
    throw err;
  }

  const { appointmentId, bookingDetails } = request;

  if (bookingDetails.confirmedDob) {
    const dob = DateTime.fromISO(bookingDetails.confirmedDob);
    if (!dob.isValid) {
      throw INVALID_INPUT_ERROR(`confirmedDob, "${bookingDetails.confirmedDob}", is not a valid iso date string`);
    }
  }

  if (bookingDetails.patientName) {
    if (bookingDetails.patientName.first !== undefined && bookingDetails.patientName.first.trim().length === 0) {
      throw INVALID_INPUT_ERROR('patientName must have a non-empty first name');
    }
    if (bookingDetails.patientName.last !== undefined && bookingDetails.patientName.last.trim().length === 0) {
      throw INVALID_INPUT_ERROR('patientName must have a non-empty last name');
    }
  }

  let serviceCategory: Coding | undefined;
  if (bookingDetails.serviceCategory) {
    serviceCategory = BOOKING_CONFIG.serviceCategories.find((sc) => sc.category.code === bookingDetails.serviceCategory)
      ?.category;
    if (!serviceCategory) {
      throw INVALID_INPUT_ERROR(`serviceCategory, "${bookingDetails.serviceCategory}", is not a valid option`);
    }
  }

  const { serviceCategory: _serviceCategoryString, ...restBookingDetails } = bookingDetails;

  // Require at least one field to be present (enforced by BookingDetailsSchema.refine).

  return {
    secrets: input.secrets,
    userToken,
    appointmentId,
    bookingDetails: {
      ...restBookingDetails,
      serviceCategory,
    },
  };
};
