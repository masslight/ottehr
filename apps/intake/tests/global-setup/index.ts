import { FullConfig } from '@playwright/test';

const globalSetup = (_config: FullConfig): void => {
  // Global setup logic here
  const processId = process.env.PLAYWRIGHT_SUITE_ID;
  if (!processId) {
    throw new Error('PLAYWRIGHT_SUITE_ID is not set. Please set it before running the tests.');
  }
  if (!processId.startsWith('intake-')) {
    throw new Error('PLAYWRIGHT_SUITE_ID must start with "intake-". Current value: ' + processId);
  }
  console.log('Running global setup for intake tests', processId);
  process.env.PLAYWRIGHT_SUITE_ID = processId;
};
export default globalSetup;
