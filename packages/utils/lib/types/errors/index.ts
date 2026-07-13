import { FhirResource } from 'fhir/r4b';

export enum APIErrorCode {
  // 40xx
  NOT_AUTHORIZED = 4000,
  CANT_UPDATE_CANCELED_APT_ERROR = 4001,
  DOB_UNCONFIRMED = 4002,
  NO_READ_ACCESS_TO_PATIENT = 4003,
  APPOINTMENT_NOT_FOUND = 4004,
  CANT_CANCEL_CHECKED_IN_APT = 4005,
  APPOINTMENT_CANT_BE_CANCELED = 4006,
  PATIENT_TOO_OLD = 4007,
  PATIENT_NOT_BORN = 4008,
  CHARACTER_LIMIT_EXCEEDED = 4009,
  SCHEDULE_NOT_FOUND = 4010,
  APPOINTMENT_CANT_BE_MODIFIED = 4011,
  APPOINTMENT_CANT_BE_IN_PAST = 4012,
  PATIENT_NOT_FOUND = 4013,
  MALFORMED_GET_ANSWER_OPTIONS_INPUT = 4014,
  ANSWER_OPTION_FROM_RESOURCE_UNDEFINED = 4015,
  BILLING_PROVIDER_NOT_FOUND = 4016,
  FHIR_RESOURCE_NOT_FOUND = 4017,
  SCHEDULE_OWNER_NOT_FOUND = 4018,
  SLOT_UNAVAILABLE = 4019,
  USER_ALREADY_EXISTS = 4020,
  PATIENT_PHONE_NOT_FOUND = 4021,
  RESOURCE_INCOMPLETE_FOR_OPERATION = 4022,
  ALREADY_EXISTS = 4023,
  CONCURRENT_UPDATE = 4024,
  // 41xx
  QUESTIONNAIRE_RESPONSE_INVALID = 4100,
  QUESTIONNAIRE_NOT_FOUND_FOR_QR = 4101,
  FHIR_RESOURCE_IS_GONE = 4102,
  PRECONDITION_FAILED = 4120,
  // 42xx
  MISSING_REQUEST_BODY = 4200,
  MISSING_REQUIRED_PARAMETERS = 4201,
  INVALID_RESOURCE_ID = 4202,
  MISSING_AUTH_TOKEN = 4203,
  MISSING_REQUEST_SECRETS = 4204,
  // 43xx
  CANNOT_JOIN_CALL_NOT_IN_PROGRESS = 4300,
  MISSING_BILLING_PROVIDER_DETAILS = 4301,
  STRIPE_CUSTOMER_ID_NOT_FOUND = 4302,
  STRIPE_RESOURCE_ACCESS_NOT_AUTHORIZED = 4303,
  MISCONFIGURED_SCHEDULING_GROUP = 4304,
  MISSING_SCHEDULE_EXTENSION = 4305,
  MISSING_PATIENT_COVERAGE_INFO = 4306,
  STRIPE_CUSTOMER_ID_DOES_NOT_EXIST = 4307,
  // 434x
  INVALID_INPUT = 4340,
  APPOINTMENT_ALREADY_EXISTS = 4341,
  PRACTITIONER_SCHEDULE_CONFLICT = 4342,
  APPOINTMENT_SEARCH_TOO_BROAD = 4343,
  // 44xx
  EXTERNAL_LAB_GENERAL = 4400,
  MISSING_NLM_API_KEY_ERROR = 4401,
  IN_HOUSE_LAB_GENERAL = 4402,
  MISSING_WC_INFO_FOR_LABS = 4403,
  ADMIN_IN_HOUSE_TEST_EXISTS = 4404,
  LABEL_PRINTING_GENERAL = 4405,
  RADIOLOGY_GENERAL = 4406,

  // 45xx
  STRIPE_PAYMENT_ERROR_GENERIC = 4500,
  STRIPE_PAYMENT_ERROR_SPECIFIC = 45001,

  // 50xx
  MISCONFIGURED_ENVIRONMENT = 5000,
}

export interface APIError {
  code?: APIErrorCode;
  message: string;
  statusCode?: number;
}

export const isApiError = (errorObject: unknown | undefined): boolean => {
  if (!errorObject) {
    return false;
  }

  let asObj = errorObject;
  if (typeof asObj === 'string') {
    try {
      asObj = JSON.parse(asObj);
    } catch {
      return false;
    }
  }

  const asAny = asObj as any;
  const output = asAny?.output;

  // Check direct properties
  if (asAny && asAny.code && asAny.message) {
    const code = asAny.code;
    const message = asAny.message;
    const isMessageString = typeof message === 'string';
    const isCodeValid = Object.values(APIErrorCode).includes(code);

    return isMessageString && isCodeValid;
  }
  // Check nested 'output' properties
  else if (output && output.code && output.message) {
    const code = output.code;
    const message = output.message;
    const isMessageString = typeof message === 'string';
    const isCodeValid = Object.values(APIErrorCode).includes(code);

    return isMessageString && isCodeValid;
  }

  return false;
};

export const NOT_AUTHORIZED: APIError = {
  code: APIErrorCode.NOT_AUTHORIZED,
  message: 'You are not authorized to access this data',
  statusCode: 401,
};

export const CANT_UPDATE_CHECKED_IN_APT_ERROR = {
  code: APIErrorCode.APPOINTMENT_CANT_BE_MODIFIED,
  message: "This appointment can't be modified because you are already checked in",
};

export const CANT_UPDATE_CANCELED_APT_ERROR = {
  code: APIErrorCode.CANT_UPDATE_CANCELED_APT_ERROR,
  message: 'You cannot modify an appointment that has been canceled',
};

export const DOB_UNCONFIRMED_ERROR = {
  code: APIErrorCode.DOB_UNCONFIRMED,
  message: 'We could not verify the date of birth supplied for this patient',
};

export const NO_READ_ACCESS_TO_PATIENT_ERROR: APIError = {
  code: APIErrorCode.NO_READ_ACCESS_TO_PATIENT,
  message: `You are not authorized to view this patient's data`,
  statusCode: 403,
};

export const APPOINTMENT_NOT_FOUND_ERROR = {
  code: APIErrorCode.APPOINTMENT_NOT_FOUND,
  message: 'Appointment is not found',
};

export const CANT_CANCEL_CHECKED_IN_APT_ERROR = {
  code: APIErrorCode.CANT_CANCEL_CHECKED_IN_APT,
  message: 'You cannot cancel a checked-in appointment',
};

export const POST_TELEMED_APPOINTMENT_CANT_BE_CANCELED_ERROR = {
  code: APIErrorCode.APPOINTMENT_CANT_BE_CANCELED,
  message: 'Post-telemed appointments are not cancelable',
};

export const POST_TELEMED_APPOINTMENT_CANT_BE_MODIFIED_ERROR = {
  code: APIErrorCode.APPOINTMENT_CANT_BE_MODIFIED,
  message: 'Post-telemed appointments cannot be rescheduled',
};

export const PAST_APPOINTMENT_CANT_BE_MODIFIED_ERROR = {
  code: APIErrorCode.APPOINTMENT_CANT_BE_MODIFIED,
  message: 'Cannot update an appointment in the past',
};

export const PATIENT_NOT_BORN_ERROR = {
  code: APIErrorCode.PATIENT_NOT_BORN,
  message: 'Appointments can not be booked for unborn patients',
};

export const BILLING_PROVIDER_RESOURCE_NOT_FOUND = {
  code: APIErrorCode.BILLING_PROVIDER_NOT_FOUND,
  message: 'A resource matching the providing billing provider reference could not be found',
};

export const BILLING_PROVIDER_RESOURCE_INCOMPLETE = {
  code: APIErrorCode.MISSING_BILLING_PROVIDER_DETAILS,
  message: 'The specified billing provider resource does not include all required data',
};

export const PATIENT_TOO_OLD_ERROR = (maxAge: number): APIError => ({
  code: APIErrorCode.PATIENT_TOO_OLD,
  message: `Patient max age is ${maxAge}`,
});

export const CHARACTER_LIMIT_EXCEEDED_ERROR = (fieldName: string, limit: number): APIError => ({
  code: APIErrorCode.CHARACTER_LIMIT_EXCEEDED,
  message: `${fieldName} exceeded length limit of ${limit} characters`,
});

export const QUESTIONNAIRE_RESPONSE_INVALID_ERROR = (errors: { [pageId: string]: string[] }): APIError => {
  return {
    code: APIErrorCode.QUESTIONNAIRE_RESPONSE_INVALID,
    message: `QuestionnaireResponse invalid fields: ${JSON.stringify(errors)}`,
  };
};

export const QUESTIONNAIRE_RESPONSE_INVALID_CUSTOM_ERROR = (message: string): APIError => {
  return {
    code: APIErrorCode.QUESTIONNAIRE_RESPONSE_INVALID,
    message,
  };
};

export const INVALID_RESOURCE_ID_ERROR = (paramName: string): APIError => {
  return {
    code: APIErrorCode.INVALID_RESOURCE_ID,
    message: `"${paramName}" value must be a valid UUID`,
  };
};

export const MISSING_AUTH_TOKEN = {
  code: APIErrorCode.MISSING_AUTH_TOKEN,
  message: 'AuthToken is not provided in headers',
};

export const QUESTIONNAIRE_NOT_FOUND_FOR_QR_ERROR = {
  code: APIErrorCode.QUESTIONNAIRE_NOT_FOUND_FOR_QR,
  message: 'The questionnaire referenced in the QuestionnaireResponse could not be found',
};

export const SCHEDULE_NOT_FOUND_ERROR = {
  code: APIErrorCode.SCHEDULE_NOT_FOUND,
  message: 'Schedule could not be found',
};

export const SCHEDULE_OWNER_NOT_FOUND_ERROR = {
  code: APIErrorCode.SCHEDULE_NOT_FOUND,
  message: 'Schedule.actor could not be found',
};

export const SCHEDULE_NOT_FOUND_CUSTOM_ERROR = (message: string): APIError => ({
  code: APIErrorCode.SCHEDULE_NOT_FOUND,
  message,
});

// Raised when a create/update/reactivate would leave more than one active
// PractitionerRole covering the same (practitioner, location, category) tuple.
// `categoryNames` is the list of overlapping category display names, used
// verbatim in the message so the admin knows which schedule to reconcile.
export const PRACTITIONER_SCHEDULE_CONFLICT_ERROR = (categoryNames: string[]): APIError => ({
  code: APIErrorCode.PRACTITIONER_SCHEDULE_CONFLICT,
  message: `This provider already has an active schedule at this location offering ${categoryNames.join(
    ', '
  )}. Remove ${categoryNames.length === 1 ? 'it' : 'them'} from that schedule first, or pick a different location.`,
});

export const APPOINTMENT_SEARCH_TOO_BROAD_ERROR: APIError = {
  code: APIErrorCode.APPOINTMENT_SEARCH_TOO_BROAD,
  message:
    'This search returned too much data to load. Please narrow the date range or select fewer locations/providers and try again.',
};

export const APPOINTMENT_CANT_BE_IN_PAST_ERROR = {
  code: APIErrorCode.APPOINTMENT_CANT_BE_IN_PAST,
  message: "An appointment can't be scheduled for a date in the past",
};

export const PATIENT_NOT_FOUND_ERROR = {
  code: APIErrorCode.PATIENT_NOT_FOUND,
  message: 'This Patient could not be found',
};

export const CANNOT_JOIN_CALL_NOT_STARTED_ERROR = {
  code: APIErrorCode.CANNOT_JOIN_CALL_NOT_IN_PROGRESS,
  message: 'This video call is not yet available or has already ended',
};

export const MISSING_REQUEST_BODY = {
  code: APIErrorCode.MISSING_REQUEST_BODY,
  message: 'The request was missing a required request body',
};

export const MISSING_REQUEST_SECRETS = {
  code: APIErrorCode.MISSING_REQUEST_SECRETS,
  message: 'The request was missing secrets required to process it',
};

export const FHIR_RESOURCE_NOT_FOUND = (resourceType: FhirResource['resourceType']): APIError => ({
  code: APIErrorCode.FHIR_RESOURCE_NOT_FOUND,
  message: `The requested ${resourceType} resource could not be found`,
});

export const FHIR_RESOURCE_NOT_FOUND_CUSTOM = (message: string): APIError => ({
  code: APIErrorCode.FHIR_RESOURCE_NOT_FOUND,
  message,
});

export const FHIR_RESOURCE_IS_GONE = (): APIError => ({
  code: APIErrorCode.FHIR_RESOURCE_IS_GONE,
  statusCode: 410,
  message: `The requested resource is gone`,
});

export const CLAIM_NOT_READY_FOR_X12_EXPORT: APIError = {
  code: APIErrorCode.RESOURCE_INCOMPLETE_FOR_OPERATION,
  statusCode: 400,
  message:
    "This claim isn't ready to export as X12. It may be missing required information or contain invalid references. Complete the claim and try again.",
};

export const MISSING_REQUIRED_PARAMETERS = (params: string[]): APIError => {
  return {
    code: APIErrorCode.MISSING_REQUIRED_PARAMETERS,
    message: `The following required parameters were missing: ${params.join(', ')}`,
  };
};

export const MALFORMED_GET_ANSWER_OPTIONS_INPUT = (message: string): APIError => ({
  code: APIErrorCode.MALFORMED_GET_ANSWER_OPTIONS_INPUT,
  message,
});

export const ANSWER_OPTION_FROM_RESOURCE_UNDEFINED = (resourceType: string): APIError => {
  return {
    code: APIErrorCode.ANSWER_OPTION_FROM_RESOURCE_UNDEFINED,
    message: `No code to map the ${resourceType} resource type to a QuestionnaireItemAnswerOption; extend the code in the get-answer-options zambda`,
  };
};

export const MISCONFIGURED_SCHEDULING_GROUP = (message: string): APIError => {
  return {
    code: APIErrorCode.MISCONFIGURED_SCHEDULING_GROUP,
    message,
  };
};
export const MISSING_SCHEDULE_EXTENSION_ERROR = {
  code: APIErrorCode.MISSING_SCHEDULE_EXTENSION,
  // todo: link to the documentation
  message: 'The schedule extension is missing from the Schedule resource',
};

export const STRIPE_CUSTOMER_ID_NOT_FOUND_ERROR: APIError = {
  code: APIErrorCode.STRIPE_CUSTOMER_ID_NOT_FOUND,
  message: 'No identifier for a Stripe customer was found on the billing Account resource associated with the patient',
};

export const STRIPE_RESOURCE_ACCESS_NOT_AUTHORIZED_ERROR: APIError = {
  code: APIErrorCode.STRIPE_RESOURCE_ACCESS_NOT_AUTHORIZED,
  message: 'Access to this Stripe resource is not authorized. Perhaps it is no longer attached to the customer',
};

export const STRIPE_CUSTOMER_ID_DOES_NOT_EXIST_ERROR: APIError = {
  code: APIErrorCode.STRIPE_CUSTOMER_ID_DOES_NOT_EXIST,
  message: 'The Stripe customer ID associated with this account does not exist and may have been deleted.',
};

export const INVALID_INPUT_ERROR = (message: string): APIError => {
  return {
    code: APIErrorCode.INVALID_INPUT,
    message,
  };
};
export const MISSING_PATIENT_COVERAGE_INFO_ERROR = {
  code: APIErrorCode.MISSING_PATIENT_COVERAGE_INFO,
  message: 'No coverage information found for this patient',
};

export const MISSING_NLM_API_KEY_ERROR: APIError = {
  code: APIErrorCode.MISSING_NLM_API_KEY_ERROR,
  message: 'No nlm api key was provided.',
};

export const EXTERNAL_LAB_ERROR = (message: string): APIError => {
  return {
    code: APIErrorCode.EXTERNAL_LAB_GENERAL,
    message,
  };
};

export const EXTERNAL_LAB_ERROR_MISSING_WC_INFO = (message: string): APIError => {
  return {
    code: APIErrorCode.MISSING_WC_INFO_FOR_LABS,
    message,
  };
};
export const ORDER_SUBMITTED_MESSAGE = 'Order is already submitted';

export const IN_HOUSE_LAB_ERROR = (message: string): APIError => {
  return {
    code: APIErrorCode.IN_HOUSE_LAB_GENERAL,
    message,
  };
};

export const MISCONFIGURED_ENVIRONMENT_ERROR = (message: string): APIError => {
  return {
    code: APIErrorCode.MISCONFIGURED_ENVIRONMENT,
    message,
  };
};

export const SLOT_UNAVAILABLE_ERROR = {
  code: APIErrorCode.SLOT_UNAVAILABLE,
  message: 'The requested slot is unavailable',
};

export const USER_ALREADY_EXISTS_ERROR = {
  code: APIErrorCode.USER_ALREADY_EXISTS,
  message: 'User is already a member of the project',
};

export const APPOINTMENT_ALREADY_EXISTS_ERROR = {
  code: APIErrorCode.APPOINTMENT_ALREADY_EXISTS,
  message: 'An appointment can not be created because the slot provided is already attached to an Appointment resource',
};

export const PATIENT_PHONE_NOT_FOUND_ERROR = {
  code: APIErrorCode.PATIENT_PHONE_NOT_FOUND,
  message: 'Patient phone number not found',
};

export const RESOURCE_INCOMPLETE_FOR_OPERATION_ERROR = (message: string): APIError => {
  return {
    code: APIErrorCode.RESOURCE_INCOMPLETE_FOR_OPERATION,
    message,
  };
};

export const ALREADY_EXISTS_WITH_MESSAGE = (message: string): APIError => {
  return {
    code: APIErrorCode.ALREADY_EXISTS,
    message,
  };
};

export const CONCURRENT_UPDATE_WITH_MESSAGE = (message: string): APIError => {
  return {
    code: APIErrorCode.CONCURRENT_UPDATE,
    message,
  };
};

export const GENERIC_STRIPE_PAYMENT_ERROR = {
  code: APIErrorCode.STRIPE_PAYMENT_ERROR_GENERIC,
  message: 'The card payment was not successful. Try a different card',
};

export const SPECIFIC_STRIPE_PAYMENT_ERROR = (message: string): APIError => {
  return {
    code: APIErrorCode.STRIPE_PAYMENT_ERROR_SPECIFIC,
    message,
  };
};

export const parseStripeError = (stripeError: any): APIError => {
  if (stripeError?.type === 'StripeCardError' && stripeError?.decline_code) {
    const { decline_code } = stripeError;
    if (decline_code === 'withdrawal_count_limit_exceeded' || decline_code === 'insufficient_funds') {
      return SPECIFIC_STRIPE_PAYMENT_ERROR('Insufficient funds. Please try different card.');
    }
    if (decline_code === 'invalid_number') {
      return SPECIFIC_STRIPE_PAYMENT_ERROR('The card number provided is invalid.');
    }

    if (decline_code === 'invalid_expiry_year') {
      return SPECIFIC_STRIPE_PAYMENT_ERROR('The expiration year provided is invalid.');
    }
    if (decline_code === 'invalid_expiry_month') {
      return SPECIFIC_STRIPE_PAYMENT_ERROR('The expiration month provided is invalid.');
    }
    if (decline_code === 'incorrect_zip') {
      return SPECIFIC_STRIPE_PAYMENT_ERROR('The ZIP code provided is incorrect.');
    }
    if (decline_code === 'incorrect_cvc') {
      return SPECIFIC_STRIPE_PAYMENT_ERROR('The CVC provided is incorrect.');
    }
    if (decline_code === 'expired_card') {
      return SPECIFIC_STRIPE_PAYMENT_ERROR('The card has expired. Please use a different card.');
    }
  }
  return GENERIC_STRIPE_PAYMENT_ERROR;
};

export const checkForStripeCustomerDeletedError = (stripeError: any): APIError | undefined => {
  if (stripeError?.code === 'resource_missing' && stripeError?.message?.includes('No such customer')) {
    return STRIPE_CUSTOMER_ID_DOES_NOT_EXIST_ERROR;
  }
  return stripeError;
};

export const ADMIN_IN_HOUSE_LAB_TEST_EXISTS_ERROR = (testName?: string): APIError => {
  return {
    code: APIErrorCode.ADMIN_IN_HOUSE_TEST_EXISTS,
    message: `A test matching that name${
      testName ? ` "${testName}"` : ''
    } already exists. Please change the name, or update the existing test`,
  };
};

export const LABEL_PRINTING_ERROR = (message: string): APIError => {
  return {
    code: APIErrorCode.LABEL_PRINTING_GENERAL,
    message,
  };
};

export const PRECONDITION_FAILED = (message?: string): APIError => ({
  code: APIErrorCode.PRECONDITION_FAILED,
  message: message ?? 'Resource was edited during operation',
});

export const RADIOLOGY_ERROR = (message: string): APIError => {
  return {
    code: APIErrorCode.RADIOLOGY_GENERAL,
    message,
  };
};
