import fs from 'fs';
import _ from 'lodash';
import { E2E_TEST_RESOURCE_PROCESS_ID_SYSTEM } from 'utils/lib/types/constants';
import {
  cleanAppointmentGraph,
  cleanupE2ELocations,
  cleanupIntegrationTestLocations,
} from 'utils/lib/utils/e2eCleanup';
import { createOystehrClientFromConfig } from './helpers';

const deleteAppointmentData = async (config: any): Promise<void> => {
  const oystehr = await createOystehrClientFromConfig(config);
  await cleanAppointmentGraph({ system: E2E_TEST_RESOURCE_PROCESS_ID_SYSTEM, code: '' }, oystehr);
  await cleanupE2ELocations(oystehr, `${E2E_TEST_RESOURCE_PROCESS_ID_SYSTEM}|`);
  await cleanupIntegrationTestLocations(oystehr);
};

const main = async (): Promise<void> => {
  const env = process.env.ENV || 'local';
  const secrets = JSON.parse(fs.readFileSync(`../../config/.env/${env}.json`, 'utf8'));
  await deleteAppointmentData(secrets);
};

main().catch((error) => {
  console.log('error', error);
  throw error;
});
