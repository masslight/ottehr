import { APIGatewayProxyResult } from 'aws-lambda';
import {
  cleanAppointmentGraph,
  cleanupE2ELocations,
  cleanupIntegrationTestAppointments,
  cleanupIntegrationTestLocations,
  cleanupIntegrationTestPatients,
  E2E_TEST_RESOURCE_PROCESS_ID_SYSTEM,
  getOptionalSecret,
} from 'utils';
import { createOystehrClient, getAuth0Token, wrapHandler, ZambdaInput } from '../../shared';

let oystehrToken: string;
export const index = wrapHandler('test-env-cleanup', async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  if (!oystehrToken) {
    console.log('getting token');
    oystehrToken = await getAuth0Token(input.secrets);
  } else {
    console.log('already have token');
  }
  const oystehr = createOystehrClient(oystehrToken, input.secrets);

  // Safe-by-default: these helpers only hard-delete when explicitly permitted. As a deployed zambda,
  // this cron reads its config from input.secrets (not process.env), so the ALLOW_HARD_DELETE flag
  // must be set per-environment in the secrets repo. Set ALLOW_HARD_DELETE="true" only in the
  // ephemeral test environments where this cron should purge; leave it unset everywhere else
  // (production included) so it merely hides E2E appointments and skips destructive cleanup — i.e.
  // this cron can never destroy data if it is ever (mis)deployed against a real environment.
  const allowHardDelete = getOptionalSecret('ALLOW_HARD_DELETE', input.secrets) === 'true';

  // Clean up E2E test resources (Playwright tests)
  await cleanAppointmentGraph({ system: E2E_TEST_RESOURCE_PROCESS_ID_SYSTEM, code: '' }, oystehr, allowHardDelete);
  await cleanupE2ELocations(oystehr, `${E2E_TEST_RESOURCE_PROCESS_ID_SYSTEM}|`, allowHardDelete);

  // Clean up integration test resources (Vitest tests with OTTEHR_AUTOMATED_TEST tag)
  await cleanupIntegrationTestAppointments(oystehr, allowHardDelete);
  await cleanupIntegrationTestPatients(oystehr, allowHardDelete);
  await cleanupIntegrationTestLocations(oystehr, allowHardDelete);

  return {
    statusCode: 200,
    body: JSON.stringify({}),
  };
});
