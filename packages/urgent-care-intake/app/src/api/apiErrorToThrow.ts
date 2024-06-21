import { Dispatch } from 'react';
import { updateNetworkError } from '../store/IntakeActions';
import { IntakeAction } from '../store/types';

const InternalError: ApiError = {
  message: 'Internal Service Error',
};

interface ApiError {
  message: string;
}

const isApiError = (error: any): boolean => error instanceof Object && error && 'message' in error;

export const apiErrorToThrow = (error: any, dispatch: Dispatch<IntakeAction>): ApiError => {
  updateNetworkError(true, dispatch);
  console.error(`Top level catch block:\nError: ${error}\nError stringified: ${JSON.stringify(error)}`);
  if (isApiError(error)) {
    return error;
  } else {
    console.error('An endpoint threw and did not provide a well formed ApiError');
    return InternalError;
  }
};
