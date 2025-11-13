import * as fs from 'fs';
import * as path from 'path';
// @ts-expect-error: Could not find a declaration file for module '../../scripts/setup/setup.utils.mjs'
import setup from '../../scripts/setup/setup.utils.mjs';
import { validateE2EIntakeUser } from './validate-e2e-intake-user.js';

const isCI: boolean = Boolean(process.env.CI);
const playwrightUserFile: string = './playwright/user.json';
const playwrightUserFileCode: string = JSON.stringify({ cookies: [], origins: [] }, null, 2);

// copy secrets only on local machine; GitHub workflow handles it on its own
if (!isCI) {
  void (async (): Promise<void> => {
    await setup.loadEnvFilesFromRepo('git@github.com:masslight/ottehr-secrets.git', [
      {
        localEnvFolder: './env/',
        repoEnvFolder: './ottehr-secrets/intake/app/',
        envsToCopy: [
          '.env.demo',
          '.env.local',
          '.env.development',
          '.env.staging',
          '.env.testing',
          'tests.local.json',
          'tests.demo.json',
          'tests.development.json',
          'tests.staging.json',
          'tests.testing.json',
        ],
      },
      {
        localEnvFolder: '../../packages/zambdas/.env',
        repoEnvFolder: './ottehr-secrets/zambdas/',
        envsToCopy: ['demo.json', 'development.json', 'local.json', 'staging.json', 'testing.json'],
      },
    ]);
  })();
}

let isUserValid = false;
try {
  validateE2EIntakeUser(playwrightUserFile);
  isUserValid = true;
} catch (error) {
  console.error('Failed to validate user:', error);
}

// Create a blank playwright/user.json file if it doesn't exist or the login is expired
if (!isUserValid) {
  const playwrightDir: string = path.dirname(playwrightUserFile);
  if (!fs.existsSync(playwrightDir)) {
    fs.mkdirSync(playwrightDir, { recursive: true });
  }
  fs.writeFileSync(playwrightUserFile, playwrightUserFileCode);
  console.log('playwright/user.json created successfully.');
}
