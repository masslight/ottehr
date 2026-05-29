import { APIGatewayProxyResult } from 'aws-lambda';
import {
  cleanAppointmentGraph,
  cleanupE2ELocations,
  cleanupIntegrationTestAppointments,
  cleanupIntegrationTestLocations,
  cleanupIntegrationTestPatients,
  E2E_TEST_RESOURCE_PROCESS_ID_SYSTEM,
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

  // Safe-by-default: these helpers only hard-delete when ALLOW_HARD_DELETE is set. This cron is
  // intended for ephemeral test environments, so its deployment must set ALLOW_HARD_DELETE=true to
  // actually purge resources. Without it, E2E appointments are merely hidden and locations/
  // integration resources are left untouched — which guarantees this cron can never destroy data if
  // it is ever (mis)deployed against production.
  // Clean up E2E test resources (Playwright tests)
  await cleanAppointmentGraph({ system: E2E_TEST_RESOURCE_PROCESS_ID_SYSTEM, code: '' }, oystehr);
  await cleanupE2ELocations(oystehr, `${E2E_TEST_RESOURCE_PROCESS_ID_SYSTEM}|`);

  // Clean up integration test resources (Vitest tests with OTTEHR_AUTOMATED_TEST tag)
  await cleanupIntegrationTestAppointments(oystehr);
  await cleanupIntegrationTestPatients(oystehr);
  await cleanupIntegrationTestLocations(oystehr);

  return {
    statusCode: 200,
    body: JSON.stringify({}),
  };
});
