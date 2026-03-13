import { getAuth0Token } from 'tests/e2e-utils/auth/getAuth0Token';
import {
  cleanAppointmentGraph,
  cleanupE2ELocations,
  createOystehrClient,
  E2E_TEST_RESOURCE_PROCESS_ID_SYSTEM,
  getSecret,
  Secrets,
  SecretsKeys,
} from 'utils';

const globalTeardown = async (): Promise<void> => {
  // Global setup logic here
  console.log('Running global teardown for EHR tests');
  const playwrightSuiteId = process.env.PLAYWRIGHT_SUITE_ID;
  const FHIR_API = getSecret(SecretsKeys.FHIR_API, process.env as Secrets).replace(/\/r4/g, '');
  const PROJECT_API = getSecret(SecretsKeys.PROJECT_API, process.env as Secrets);
  const token = await getAuth0Token();
  const oystehr = createOystehrClient(token, FHIR_API, PROJECT_API);
  await cleanAppointmentGraph({ system: E2E_TEST_RESOURCE_PROCESS_ID_SYSTEM, code: playwrightSuiteId }, oystehr);
  // delete locations that were created solely for testing
  await cleanupE2ELocations(oystehr, `${E2E_TEST_RESOURCE_PROCESS_ID_SYSTEM}|${playwrightSuiteId}`);
};
export default globalTeardown;
