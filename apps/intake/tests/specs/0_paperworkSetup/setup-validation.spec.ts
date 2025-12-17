import { test } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

/**
 * This test validates that paperwork-setup completed successfully.
 * It checks for the .setup-complete marker file written at the end of setup.spec.ts.
 *
 * This runs as a separate project that chromium depends on, so if this fails,
 * all chromium tests are automatically skipped.
 */
test('Validate paperwork setup completed', async () => {
  const markerPath = path.join('test-data', '.setup-complete');

  if (!fs.existsSync(markerPath)) {
    throw new Error(
      'PAPERWORK SETUP DID NOT COMPLETE\n\n' +
        'The .setup-complete marker file is missing, which means one or more\n' +
        'paperwork-setup tests failed. Please check the paperwork-setup test\n' +
        'results for errors before running the main test suite.'
    );
  }

  console.log('✓ Setup validation passed. Proceeding with main tests.');
});
