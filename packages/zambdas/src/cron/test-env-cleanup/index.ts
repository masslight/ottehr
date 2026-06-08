import { APIGatewayProxyResult } from 'aws-lambda';
import {
  cleanAppointmentGraph,
  cleanupE2ELocations,
  cleanupIntegrationTestAppointments,
  cleanupIntegrationTestLocations,
  cleanupIntegrationTestPatients,
  E2E_TEST_RESOURCE_PROCESS_ID_SYSTEM,
} from 'utils';
import { createClinicalOystehrClient, getAuth0Token, wrapHandler, ZambdaInput } from '../../shared';

let oystehrToken: string;
export const index = wrapHandler('test-env-cleanup', async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  if (!oystehrToken) {
    console.log('getting token');
    oystehrToken = await getAuth0Token(input.secrets);
  } else {
    console.log('already have token');
  }
  const oystehr = createClinicalOystehrClient(oystehrToken, input.secrets);

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
