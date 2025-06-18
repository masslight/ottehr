import { APIError, APIErrorCode, isApiError } from 'utils';

export type FormValidationErrorObject = { [pageId: string]: string[] };
export const getFormValidationErrors = (error: any): FormValidationErrorObject | undefined => {
  if (isApiError(error)) {
    const apiError = error as APIError;
    if (apiError.code === APIErrorCode.QUESTIONNAIRE_RESPONSE_INVALID) {
      const errorJson = apiError.message.split(':')?.slice(1)?.join(':');
      console.log('errorJson', errorJson);
      if (errorJson) {
        try {
          return JSON.parse(errorJson) as FormValidationErrorObject;
        } catch (e) {
          console.error('could not parse validation error message', e);
        }
      }
    }
  }
  return undefined;
};
