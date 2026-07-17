import Oystehr, { BatchInputDeleteRequest, FhirResource, FhirSearchParams } from '@oystehr/sdk';
import { getAllFhirSearchPages } from 'utils/lib/fhir/getAllFhirSearchPages';
import { INTEGRATION_TEST_PROCESS_ID_SYSTEM, INTEGRATION_TEST_RUN_SYSTEM } from './integration-tags';

/**
 * Resource types the integration suite is known to create. The leak gate searches each by the
 * per-run tag. Over-inclusion is harmless (an empty search); a missing type would hide a leak, so
 * this list errs broad. Typed against the SDK's resourceType union so a typo fails to compile.
 */
const LEAK_SWEEP_RESOURCE_TYPES: FhirResource['resourceType'][] = [
  'Account',
  'AllergyIntolerance',
  'Appointment',
  'ChargeItem',
  'ChargeItemDefinition',
  'Claim',
  'ClinicalImpression',
  'Communication',
  'Consent',
  'Coverage',
  'DiagnosticReport',
  'DocumentReference',
  'Encounter',
  'EpisodeOfCare',
  'HealthcareService',
  'List',
  'Location',
  'MedicationAdministration',
  'MedicationRequest',
  'MedicationStatement',
  'Observation',
  'Organization',
  'Patient',
  'Person',
  'Practitioner',
  'PractitionerRole',
  'Procedure',
  'QuestionnaireResponse',
  'RelatedPerson',
  'Schedule',
  'ServiceRequest',
  'Slot',
  'Specimen',
  'Task',
];

/**
 * Per-test cleanup (cleanAppointmentGraph, in each file's afterAll) is the primary mechanism: it runs
 * incrementally so the shared backend's footprint stays small during the run and resources are freed
 * even if a later file crashes. This end-of-run sweep is the comprehensive *backstop* — it deletes
 * anything per-test cleanup couldn't reach (e.g. standalone Patients/Lists not rooted at an
 * Appointment), found by the run tag.
 *
 * 'warn': clean + log those stragglers without failing the run (the backstop owns mop-up).
 * 'fail': additionally fail the run, to force every test to be fully self-cleaning.
 */
// `as` (not a plain annotation) keeps the type the full union so both `=== 'fail'` and `=== 'warn'`
// stay valid comparisons — otherwise TS narrows this const to its literal and flags one as TS2367.
const LEAK_GATE_MODE = 'warn' as 'fail' | 'warn';

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Suite-wide leak gate. Run once from the global-setup teardown, AFTER every test file's own cleanup
 * has executed. It searches every resource type for THIS run's tag; anything still present escaped
 * cleanup. Survivors are reported (grouped by the processId tag — i.e. the test file that created
 * them), best-effort deleted so they don't accumulate on the shared backend, and, in 'fail' mode,
 * cause the run to fail.
 *
 * Scope: covers every resource stamped by addProcessIdMetaTagToResource / insertInPersonAppointmentBase
 * (and the shared M2M profiles). Tests that create resources by other means are not yet covered; route
 * their creates through addProcessIdMetaTagToResource to bring them under the gate.
 *
 * @param oystehr - Admin Oystehr client (FHIR API; independent of the local zambda server)
 * @param runId - The per-run id stamped onto this run's resources
 */
export const assertNoLeakedResourcesForRun = async (oystehr: Oystehr, runId: string): Promise<void> => {
  const tagValue = `${INTEGRATION_TEST_RUN_SYSTEM}|${runId}`;

  const findSurvivors = async (): Promise<FhirResource[]> => {
    const found: FhirResource[] = [];
    for (const resourceType of LEAK_SWEEP_RESOURCE_TYPES) {
      try {
        const searchParams: FhirSearchParams<FhirResource> = {
          resourceType,
          params: [{ name: '_tag', value: tagValue }],
        };
        found.push(...(await getAllFhirSearchPages(searchParams, oystehr)));
      } catch (e) {
        console.error(`[leak-gate] search failed for ${resourceType}: ${e}`);
      }
    }
    return found;
  };

  // FHIR search is eventually consistent; let just-deleted resources settle, and only treat a
  // resource as leaked if it persists across a re-check.
  await sleep(5000);
  let survivors = await findSurvivors();
  if (survivors.length > 0) {
    await sleep(5000);
    survivors = await findSurvivors();
  }

  if (survivors.length === 0) {
    console.log(`[leak-gate] no leaked resources for run ${runId}`);
    return;
  }

  // Group survivors by processId tag (→ originating test file) for an actionable report.
  const byProcess = new Map<string, Map<string, number>>();
  for (const resource of survivors) {
    const processId =
      resource.meta?.tag?.find((t) => t.system === INTEGRATION_TEST_PROCESS_ID_SYSTEM)?.code ??
      '(run tag only - shared infra or untagged create)';
    const types = byProcess.get(processId) ?? new Map<string, number>();
    types.set(resource.resourceType, (types.get(resource.resourceType) ?? 0) + 1);
    byProcess.set(processId, types);
  }
  const report = [...byProcess.entries()]
    .map(
      ([processId, types]) =>
        `  ${processId}\n` +
        [...types.entries()].map(([resourceType, count]) => `    ${resourceType}: ${count}`).join('\n')
    )
    .join('\n');
  const swept = LEAK_GATE_MODE === 'warn' ? ' (swept by this backstop)' : '';
  const headline = `[leak-gate] ${survivors.length} resource(s) survived per-test cleanup${swept} for run ${runId}, grouped by test (processId):`;
  console.error(`${headline}\n${report}`);

  // Best-effort delete so leaked resources don't pile up on the shared backend across runs. Use
  // batch (independent ops, partial success) over transaction (atomic); two passes let resources
  // delete once their referrers are gone.
  const deleteRequests: BatchInputDeleteRequest[] = survivors
    .filter((resource) => resource.id)
    .map((resource) => ({ method: 'DELETE', url: `${resource.resourceType}/${resource.id}` }));
  for (let pass = 0; pass < 2; pass++) {
    for (let i = 0; i < deleteRequests.length; i += 100) {
      try {
        await oystehr.fhir.batch({ requests: deleteRequests.slice(i, i + 100) });
      } catch (e) {
        console.error(`[leak-gate] best-effort delete failed: ${e}`);
      }
    }
  }

  if (LEAK_GATE_MODE === 'fail') {
    throw new Error(`${headline}\n${report}`);
  }
};
