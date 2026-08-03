import retry from 'retry';

// Kept short because a webhook handler is waiting on this: randomize scales each backoff by 1-2x,
// so the whole budget is 3.5-6s.
const ADVAPACS_RETRY_OPTIONS: retry.OperationOptions = {
  retries: 3,
  factor: 2,
  minTimeout: 500,
  maxTimeout: 2000,
  randomize: true,
};

/**
 * fetch wrapper that retries network failures with backoff. Responses resolve untouched, ok or not —
 * AdvaPACS answered, so the status is the caller's to handle. Only a thrown error is retried, meaning
 * no response came back, which is why replaying even a write is safe.
 */
export const advaPacsFetch = async (url: string, init: RequestInit): Promise<Response> => {
  const operation = retry.operation(ADVAPACS_RETRY_OPTIONS);
  const description = `${init.method ?? 'GET'} ${url}`;

  return new Promise<Response>((resolve, reject) => {
    operation.attempt(async (currentAttempt) => {
      try {
        resolve(await fetch(url, init));
      } catch (error: unknown) {
        const errorObj = error instanceof Error ? error : new Error(String(error));
        console.info(`advaPacsFetch: network error on attempt ${currentAttempt} for ${description}:`, errorObj.message);

        if (!operation.retry(errorObj)) {
          console.error(`advaPacsFetch: ${description} failed after ${currentAttempt} attempts`);
          reject(operation.mainError());
        }
      }
    });
  });
};
