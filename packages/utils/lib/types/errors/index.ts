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
  QUESTIONNAIRE_RESPONSE_INVALID = 4100,
  MISSING_REQUEST_BODY = 4200,
  CANNOT_JOIN_CALL_NOT_IN_PROGRESS = 4300,
  MISSING_BILLING_PROVIDER_DETAILS = 4301,
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

export const SCHEDULE_NOT_FOUND_ERROR = {
  code: APIErrorCode.SCHEDULE_NOT_FOUND,
  message: 'Schedule could not be found',
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
  message: "This video call cannot be joined because it's either ended or not have been started",
};

export const MISSING_REQUEST_BODY = {
  code: APIErrorCode.MISSING_REQUEST_BODY,
  message: 'The request was missing a required request body',
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
