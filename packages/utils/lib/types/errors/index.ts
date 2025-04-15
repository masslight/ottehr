import { FhirResource } from 'fhir/r4b';

export enum APIErrorCode {
  NOT_AUTHORIZED = 4000,
  CANT_UPDATE_CANCELED_APT_ERROR = 4001,
  DOB_UNCONFIRMED = 4002,
  NO_READ_ACCESS_TO_PATIENT = 4003,
  APPOINTMENT_NOT_FOUND = 4004,
  CANT_CANCEL_CHECKEDIN_APT = 4005,
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
  QUESTIONNAIRE_RESPONSE_INVALID = 4100,
  QUESTIONNAIRE_NOT_FOUND_FOR_QR = 4101,
  MISSING_REQUEST_BODY = 4200,
  MISSING_REQUIRED_PARAMETERS = 4201,
  INVALID_RESOURCE_ID = 4202,
  CANNOT_JOIN_CALL_NOT_IN_PROGRESS = 4300,
  MISSING_BILLING_PROVIDER_DETAILS = 4301,
  STRIPE_CUSTOMER_ID_NOT_FOUND = 4302,
  STRIPE_RESOURCE_ACCESS_NOT_AUTHORIZED = 4303,
  MISCONFIGURED_SCHEDULING_GROUP = 4304,
  MISSING_SCHEDULE_EXTENSION = 4305,
  MISSING_PATIENT_COVERAGE_INFO = 4306,
  INVALID_INPUT = 4340,
}

export interface APIError {
  code?: APIErrorCode;
  message: string;
}

export const isApiError = (errorObject: unknown | undefined): boolean => {
  if (!errorObject) {
    return false;
  }
  let asObj = errorObject;
  if (typeof asObj === 'string') {
    try {
      asObj = JSON.parse(asObj);
    } catch (_) {
      return false;
    }
  }
  const asAny = asObj as any;
  const output = asAny?.output;
  if (asAny && asAny.code && asAny.message) {
    return typeof asAny.message === 'string' && Object.values(APIErrorCode).includes(asAny.code);
  } else if (output && output.code && output.message) {
    return typeof output.message === 'string' && Object.values(APIErrorCode).includes(output.code);
  }
  return false;
};

export const NOT_AUTHORIZED = {
  code: APIErrorCode.NOT_AUTHORIZED,
  message: 'You are not authorized to access this data',
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

export const NO_READ_ACCESS_TO_PATIENT_ERROR = {
  code: APIErrorCode.NO_READ_ACCESS_TO_PATIENT,
  message: `You are not authorized to view this patient's data`,
};

export const APPOINTMENT_NOT_FOUND_ERROR = {
  code: APIErrorCode.APPOINTMENT_NOT_FOUND,
  message: 'Appointment is not found',
};

export const CANT_CANCEL_CHECKEDIN_APT_ERROR = {
  code: APIErrorCode.CANT_CANCEL_CHECKEDIN_APT,
  message: 'You cannot cancel a checked-in appointment',
};

export const POST_TELEMED_APPOINTMENT_CANT_BE_CANCELED_ERROR = {
  code: APIErrorCode.APPOINTMENT_CANT_BE_CANCELED,
  message: 'Post-telemed appointments are not cancelable',
};

export const POST_TELEMED_APPOINTMENT_CANT_BE_MODIFIED_ERROR = {
  code: APIErrorCode.APPOINTMENT_CANT_BE_MODIFIED,
  message: 'Post-telemed appointments are not reschedulable',
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
  message: "This video call cannot be joined because it's either ended or not have been started",
};

export const MISSING_REQUEST_BODY = {
  code: APIErrorCode.MISSING_REQUEST_BODY,
  message: 'The request was missing a required request body',
};

export const FHIR_RESOURCE_NOT_FOUND = (resourceType: FhirResource['resourceType']): APIError => ({
  code: APIErrorCode.FHIR_RESOURCE_NOT_FOUND,
  message: `The requested ${resourceType} resource could not be found`,
});

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
export const SLOT_UNAVAILABLE_ERROR = {
  code: APIErrorCode.SLOT_UNAVAILABLE,
  message: 'The requested slot is unavailable',
};
