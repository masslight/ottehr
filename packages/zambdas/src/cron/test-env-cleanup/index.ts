import { APIGatewayProxyResult } from 'aws-lambda';
import { E2E_TEST_RESOURCE_PROCESS_ID_SYSTEM } from 'utils/lib/types/constants';
import {
  cleanAppointmentGraph,
  cleanupE2ELocations,
  cleanupIntegrationTestAppointments,
  cleanupIntegrationTestHealthcareServices,
  cleanupIntegrationTestLocations,
  cleanupIntegrationTestPatients,
  cleanupIntegrationTestQuestionnaires,
} from 'utils/lib/utils/e2eCleanup';
import { getAuth0Token } from '../../shared/getAuth0Token';
import { createClinicalOystehrClient } from '../../shared/helpers';
import { wrapHandler } from '../../shared/sentry';
import { ZambdaInput } from '../../shared/types/common';

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
  await cleanupIntegrationTestHealthcareServices(oystehr);
  await cleanupIntegrationTestQuestionnaires(oystehr);

  return {
    statusCode: 200,
    body: JSON.stringify({}),
  };
});
