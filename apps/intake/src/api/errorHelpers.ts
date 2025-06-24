import { APIError, isApiError } from 'utils';
import { useIntakeCommonStore } from '../features/common';

type InternalError = Omit<APIError, 'code'>;
type NetworkError = InternalError | APIError;

const IntError = {
  message: 'Internal Service Error',
};

export const apiErrorToThrow = (error: any, setGlobalErrorState = true): NetworkError => {
  if (setGlobalErrorState) {
    useIntakeCommonStore.setState({ networkError: true });
  }
  console.error(`Top level catch block:\nError: ${error}\nError stringified: ${JSON.stringify(error)}`);
  if (isApiError(error)) {
    return error;
  } else {
    console.error('An endpoint threw and did not provide a well formed ApiError');
    return IntError;
  }
};
