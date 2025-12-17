import { test } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

/**
 * This test validates that ALL paperwork-setup tests passed.
 * The marker file is only written by setup.spec.ts if ALL tests passed.
 *
 * If this validation fails, chromium tests will be skipped (via dependencies).
 */
test('Validate all setup tests passed', async () => {
  const markerPath = path.join('test-data', '.setup-complete');

  if (!fs.existsSync(markerPath)) {
    throw new Error(
      'SETUP FAILED: The .setup-complete marker file is missing.\n\n' +
        'This means one or more paperwork-setup tests failed.\n' +
        'Chromium tests will be skipped.\n\n' +
        'Please check the paperwork-setup test results for errors.'
    );
  }

  console.log('✓ Setup validation passed. All setup tests completed successfully.');
});
