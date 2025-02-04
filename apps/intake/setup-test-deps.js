import * as fs from 'fs';
import * as path from 'path';
import setup from '../../scripts/setup/setup.utils.mjs';

const isCI = Boolean(process.env.CI);
const playwrightUserFile = './playwright/user.json';
const platwrightUserFileCode = JSON.stringify({ cookies: [], origins: [] }, null, 2);

// сopy secrets only on local machine; GitHub workflow handles it on its own
if (!isCI) {
  void (async () => {
    await setup.loadEnvFilesFromRepo('git@github.com:masslight/ottehr-secrets.git', [
      {
        localEnvFolder: './env/',
        repoEnvFolder: './ottehr-secrets/intake/app/',
        envsToCopy: ['.env.demo', '.env.local'],
      },
      {
        localEnvFolder: './env/',
        repoEnvFolder: './ottehr-secrets/intake/app/',
        envsToCopy: ['tests.local.json', 'tests.demo.json'],
      },
      {
        localEnvFolder: '../../packages/intake/zambdas/.env',
        repoEnvFolder: './ottehr-secrets/zambdas/',
        envsToCopy: ['demo.json', 'local.json'],
      },
    ]);
  })();
}

// Create the playwright/user.json file if it doesn't exist
if (!fs.existsSync(playwrightUserFile)) {
  const playwrightDir = path.dirname(playwrightUserFile);
  if (!fs.existsSync(playwrightDir)) {
    fs.mkdirSync(playwrightDir, { recursive: true });
  }
  fs.writeFileSync(playwrightUserFile, platwrightUserFileCode);
  console.log('playwright/user.json created successfully.');
}
