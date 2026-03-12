#!/usr/bin/env tsx

import Oystehr from '@oystehr/sdk';
import { readFileSync, writeFileSync } from 'fs';
import { resolve } from 'path';

async function main(): Promise<void> {
  const env = process.argv[2] || process.env.ENV || 'local';
  const zambdasRoot = resolve(__dirname, '..');
  const envFilePath = resolve(zambdasRoot, '.env', `${env}.json`);
  const outputFilePath = resolve(zambdasRoot, '.env', `zambda-secrets-${env}.json`);

  console.log(`Reading env file: ${envFilePath}`);
  const envFile: Record<string, string> = JSON.parse(readFileSync(envFilePath, { encoding: 'utf8' }));

  const { AUTH0_ENDPOINT, AUTH0_CLIENT, AUTH0_SECRET, AUTH0_AUDIENCE, PROJECT_API, FHIR_API } = envFile;

  if (!AUTH0_ENDPOINT || !AUTH0_CLIENT || !AUTH0_SECRET || !AUTH0_AUDIENCE || !PROJECT_API || !FHIR_API) {
    throw new Error(
      `Missing required auth credentials in ${envFilePath}. Ensure AUTH0_ENDPOINT, AUTH0_CLIENT, AUTH0_SECRET, AUTH0_AUDIENCE, PROJECT_API, and FHIR_API are set.`
    );
  }

  console.log('Fetching M2M token...');
  const tokenResponse = await fetch(AUTH0_ENDPOINT, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      grant_type: 'client_credentials',
      client_id: AUTH0_CLIENT,
      client_secret: AUTH0_SECRET,
      audience: AUTH0_AUDIENCE,
    }),
  });

  if (!tokenResponse.ok) {
    throw new Error(`Failed to fetch token: ${tokenResponse.status} ${tokenResponse.statusText}`);
  }

  const { access_token } = (await tokenResponse.json()) as { access_token: string };

  const oystehr = new Oystehr({
    accessToken: access_token,
    fhirApiUrl: FHIR_API.replace(/\/r4$/, ''),
    projectApiUrl: PROJECT_API,
  });

  console.log('Listing Zambda secrets...');
  const secretList = await oystehr.secret.list();
  console.log(`Found ${secretList.length} secrets, fetching values...`);

  const secrets: Record<string, string> = {};
  await Promise.all(
    secretList.map(async ({ name }) => {
      const secret = await oystehr.secret.get({ name });
      secrets[name] = secret.value;
    })
  );

  writeFileSync(outputFilePath, JSON.stringify(secrets, null, 2), { encoding: 'utf8' });
  console.log(`Wrote ${Object.keys(secrets).length} secrets to ${outputFilePath}`);
}

main().catch((error) => {
  console.error('Error fetching Zambda secrets:', error);
  process.exit(1);
});
