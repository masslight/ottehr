/**
 * The Oystehr SDK throws `OystehrSdkError`, which carries the HTTP status on `code`. A 403 means the
 * signed-in user's role does not grant the action — permanent for that user, so retrying or polling can
 * never succeed. Callers should stop and say what happened instead of spinning or reporting a generic
 * "try again" failure.
 */
export const isPermissionDeniedError = (error: unknown): boolean => {
  if (!error || typeof error !== 'object') {
    return false;
  }
  const { code, status } = error as { code?: unknown; status?: unknown };
  return code === 403 || status === 403;
};
