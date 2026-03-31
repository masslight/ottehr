import { APIGatewayProxyResult } from 'aws-lambda';
import {
  cleanAppointmentGraph,
  cleanupE2ELocations,
  cleanupIntegrationTestAppointments,
  cleanupIntegrationTestLocations,
  cleanupIntegrationTestPatients,
  E2E_TEST_RESOURCE_PROCESS_ID_SYSTEM,
  getSecret,
  SecretsKeys,
} from 'utils';
import { createOystehrClient, getAuth0Token, topLevelCatch, wrapHandler, ZambdaInput } from '../../shared';

let oystehrToken: string;
export const index = wrapHandler('test-env-cleanup', async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  try {
    if (!oystehrToken) {
      console.log('getting token');
      oystehrToken = await getAuth0Token(input.secrets);
    } else {
      console.log('already have token');
    }
    const oystehr = createOystehrClient(oystehrToken, input.secrets);

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
  } catch (error: any) {
    const ENVIRONMENT = getSecret(SecretsKeys.ENVIRONMENT, input.secrets);
    return topLevelCatch('test-env-cleanup', error, ENVIRONMENT);
  }
});
