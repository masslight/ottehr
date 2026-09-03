import Oystehr from '@oystehr/sdk';

const RESPONSE_SIZE_EXCEEDED_CODE = 4130;
const RESPONSE_SIZE_EXCEEDED_MESSAGE = 'exceeds the maximum allowed size';

export const isResponseSizeExceededError = (error: unknown): boolean => {
  const rawCode = (error as { code?: unknown })?.code;
  const code = rawCode == null ? NaN : Number(rawCode);

  if (error instanceof Oystehr.OystehrSdkError || Number.isFinite(code)) {
    return code === RESPONSE_SIZE_EXCEEDED_CODE;
  }

  const message = (error as { message?: unknown })?.message;
  return typeof message === 'string' && message.includes(RESPONSE_SIZE_EXCEEDED_MESSAGE);
};
