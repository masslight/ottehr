import fs from 'fs';
import _ from 'lodash';
import {
  cleanAppointmentGraph,
  cleanupE2ELocations,
  cleanupIntegrationTestLocations,
  E2E_TEST_RESOURCE_PROCESS_ID_SYSTEM,
} from 'utils';
import { createOystehrClientFromConfig } from './helpers';

const deleteAppointmentData = async (config: any): Promise<void> => {
  const oystehr = await createOystehrClientFromConfig(config);
  // Safe-by-default: with no ALLOW_HARD_DELETE set this HIDES test appointments and skips location
  // cleanup rather than deleting (this script has no confirmation prompt and reads ENV directly, so
  // it must never delete from production by accident). To actually purge an ephemeral test env, run
  // with ALLOW_HARD_DELETE=true.
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
