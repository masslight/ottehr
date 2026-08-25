import Oystehr from '@oystehr/sdk';

/**
 * Query used to warm the connection. Its result is discarded, so the only thing that matters is that
 * it is a well-formed code.
 */
export const TERMINOLOGY_WARMUP_QUERY = 'Z00.00';

/**
 * Opens a connection to the terminology host and throws the answer away.
 *
 * Call this as early in the handler as possible and await it just before the validation fan-out. The
 * point is *when* it runs, not what it returns: the handler already spends ~200ms reading the E&M
 * ValueSet and 2-3s in the model call, so the terminology host's cold start can be paid
 * underneath work that is on the critical path anyway rather than added on top of it.
 *
 * Any query warms the connection, so a failure here is logged and ignored — a warm-up must never be
 * able to fail the request.
 */
export function warmTerminologyConnection(oystehr: Oystehr): Promise<void> {
  const startedAt = Date.now();
  return oystehr.terminology
    .searchIcd10({ query: TERMINOLOGY_WARMUP_QUERY, searchType: 'code', limit: 1, strictMatch: true })
    .then(() => {
      console.log(`[recommend-billing-suggestions] terminology warm-up took ${Date.now() - startedAt}ms`);
    })
    .catch((error) => {
      // Attached here rather than at the await site so that an early rejection cannot surface as an
      // unhandled rejection while the promise sits unawaited through the model call.
      console.warn(
        `[recommend-billing-suggestions] terminology warm-up failed after ${Date.now() - startedAt}ms:`,
        error
      );
    });
}
