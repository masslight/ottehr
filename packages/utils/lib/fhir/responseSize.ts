const RESPONSE_SIZE_EXCEEDED_CODE = 4130;
const RESPONSE_SIZE_EXCEEDED_MESSAGE = 'exceeds the maximum allowed size';

const responseCode = (error: unknown): number => {
  const code = (error as { code?: unknown })?.code;
  if (typeof code === 'number') return code;
  if (typeof code === 'string' && code.trim() !== '') return Number(code);
  return NaN;
};

export const isResponseSizeExceededError = (error: unknown): boolean => {
  const code = responseCode(error);
  if (Number.isFinite(code)) return code === RESPONSE_SIZE_EXCEEDED_CODE;

  const message = (error as { message?: unknown })?.message;
  return typeof message === 'string' && message.includes(RESPONSE_SIZE_EXCEEDED_MESSAGE);
};
