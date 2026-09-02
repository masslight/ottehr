import Oystehr from '@oystehr/sdk';

const RESPONSE_SIZE_EXCEEDED_CODE = 4130;
const RESPONSE_SIZE_EXCEEDED_MESSAGE = 'exceeds the maximum allowed size';

export const isResponseSizeExceededError = (error: unknown): boolean => {
  const code = (error as { code?: unknown })?.code;
  if (error instanceof Oystehr.OystehrSdkError && Number(code) === RESPONSE_SIZE_EXCEEDED_CODE) return true;

  const message = (error as { message?: unknown })?.message;
  return typeof message === 'string' && message.includes(RESPONSE_SIZE_EXCEEDED_MESSAGE);
};
