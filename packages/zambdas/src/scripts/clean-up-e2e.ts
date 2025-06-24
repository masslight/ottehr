import fs from 'fs';
import _ from 'lodash';
import { cleanAppointmentGraph, E2E_TEST_RESOURCE_PROCESS_ID_SYSTEM } from 'utils';
import { createOystehrClientFromConfig } from './helpers';

const deleteAppointmentData = async (config: any): Promise<void> => {
  const oystehr = await createOystehrClientFromConfig(config);
  await cleanAppointmentGraph({ system: E2E_TEST_RESOURCE_PROCESS_ID_SYSTEM, code: '' }, oystehr);
};

const main = async (): Promise<void> => {
  const secrets = JSON.parse(fs.readFileSync(`.env/local.json`, 'utf8'));
  await deleteAppointmentData(secrets);
};

main().catch((error) => {
  console.log('error', error);
  throw error;
});
