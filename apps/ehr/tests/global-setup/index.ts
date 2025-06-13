import { FullConfig } from '@playwright/test';

const globalSetup = (_config: FullConfig): void => {
  // Global setup logic here
  const processId = process.env.PLAYWRIGHT_SUITE_ID;
  if (!processId) {
    throw new Error('PLAYWRIGHT_SUITE_ID is not set. Please set it before running the tests.');
  }
  if (!processId.startsWith('ehr-')) {
    throw new Error('PLAYWRIGHT_SUITE_ID must start with "ehr-". Current value: ' + processId);
  }
};
export default globalSetup;
