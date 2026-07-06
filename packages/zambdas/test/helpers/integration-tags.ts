import type { FhirResource } from 'fhir/r4b';

/**
 * Tag-system constants and the run-tag helper shared across the integration suite.
 *
 * This module must stay free of any `vitest` import. It is loaded from BOTH the worker context
 * (test files, via integration-test-seed-data-setup) AND the globalSetup context
 * (integration-global-setup and integration-leak-gate). Importing `vitest` in the globalSetup
 * context throws "Vitest failed to access its internal state" — which is exactly why these live
 * here rather than in integration-test-seed-data-setup, which imports `inject` from `vitest`.
 */
export const INTEGRATION_TEST_PROCESS_ID_SYSTEM = 'INTEGRATION_TEST_PROCESS_ID_SYSTEM';

/**
 * Per-run tag system. A single runId — generated once in integration-global-setup and published to
 * every worker via vitest `inject` — is stamped onto each resource the suite creates, alongside the
 * per-file processId tag. The suite-wide leak gate searches for this tag to prove every resource
 * created during THIS run was cleaned up; the runId isolates that assertion from any other run
 * sharing the same backend.
 */
export const INTEGRATION_TEST_RUN_SYSTEM = 'INTEGRATION_TEST_RUN_ID_SYSTEM';

/**
 * Stamps only the per-run tag. For resources created outside the per-file processId flow (e.g. the
 * shared M2M profiles provisioned in global setup) so the leak gate covers them too.
 * @param resource - The FHIR resource to tag
 * @param runId - The per-run id
 */
export const addRunTagToResource = (resource: FhirResource, runId: string): FhirResource => {
  const existingMeta = resource.meta || { tag: [] };
  resource.meta = {
    ...existingMeta,
    tag: [...(existingMeta.tag ?? []), { system: INTEGRATION_TEST_RUN_SYSTEM, code: runId }],
  };
  return resource;
};
