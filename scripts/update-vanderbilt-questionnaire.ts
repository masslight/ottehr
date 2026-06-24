/**
 * Overwrites the existing Vanderbilt Questionnaire resource in FHIR with the
 * updated JSON from ~/Downloads/vanderbiltParent.json, preserving id and the
 * practice-managed tag.
 *
 * Usage:
 *   npx env-cmd -f apps/ehr/env/tests.<env>.json npx tsx scripts/update-vanderbilt-questionnaire.ts
 *
 * Required env vars: AUTH0_CLIENT, AUTH0_SECRET, PROJECT_ID.
 * Optional overrides: AUTH0_ENDPOINT, AUTH0_AUDIENCE, FHIR_API.
 */
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

// todo sarah do we even need this script? i think no

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) {
    console.error(`Missing required env var: ${name}`);
    console.error('Provide credentials via env file, e.g.');
    console.error(`  npx env-cmd -f apps/ehr/env/tests.<env>.json npx tsx scripts/update-vanderbilt-questionnaire.ts`);
    process.exit(1);
  }
  return v;
}

const ENV = {
  AUTH0_ENDPOINT: process.env.AUTH0_ENDPOINT || 'https://auth.zapehr.com/oauth/token',
  AUTH0_AUDIENCE: process.env.AUTH0_AUDIENCE || 'https://api.zapehr.com',
  AUTH0_CLIENT: requireEnv('AUTH0_CLIENT'),
  AUTH0_SECRET: requireEnv('AUTH0_SECRET'),
  FHIR_API: process.env.FHIR_API || 'https://fhir-api.zapehr.com',
  PROJECT_ID: requireEnv('PROJECT_ID'),
};

const JSON_PATH = path.join(os.homedir(), 'Downloads', 'vanderbiltParent.json');
const PRACTICE_MANAGED_TAG = {
  system: 'https://fhir.ottehr.com/CodeSystem/questionnaire-type',
  code: 'practice-managed',
};

async function getToken(): Promise<string> {
  const res = await fetch(ENV.AUTH0_ENDPOINT, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      grant_type: 'client_credentials',
      client_id: ENV.AUTH0_CLIENT,
      client_secret: ENV.AUTH0_SECRET,
      audience: ENV.AUTH0_AUDIENCE,
    }),
  });
  const data = (await res.json()) as { access_token: string };
  return data.access_token;
}

async function fhirGet(token: string, p: string): Promise<any> {
  const res = await fetch(`${ENV.FHIR_API}/r4/${p}`, {
    headers: { Authorization: `Bearer ${token}`, 'x-zapehr-project-id': ENV.PROJECT_ID },
  });
  if (!res.ok) throw new Error(`GET ${p} failed: ${res.status} ${await res.text()}`);
  return res.json();
}

async function fhirPut(token: string, resourceType: string, id: string, body: any): Promise<any> {
  const res = await fetch(`${ENV.FHIR_API}/r4/${resourceType}/${id}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      'x-zapehr-project-id': ENV.PROJECT_ID,
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`PUT ${resourceType}/${id} failed: ${res.status} ${await res.text()}`);
  return res.json();
}

async function main(): Promise<void> {
  const token = await getToken();
  const updated = JSON.parse(fs.readFileSync(JSON_PATH, 'utf8'));
  const canonicalUrl =
    updated.url || 'https://ottehr.com/FHIR/Questionnaire/nichq-vanderbilt-assessment-scale-parent-informant';
  updated.url = canonicalUrl;

  console.log(`Looking up existing Vanderbilt Q by URL ${canonicalUrl}...`);
  const bundle = await fhirGet(
    token,
    `Questionnaire?url=${encodeURIComponent(canonicalUrl)}&_sort=-_lastUpdated&_count=1`
  );
  const existing = bundle.entry?.[0]?.resource;
  if (!existing) throw new Error('No existing Vanderbilt Questionnaire found with that URL');
  console.log(`  existing id: ${existing.id}`);

  const merged = {
    ...updated,
    resourceType: 'Questionnaire',
    id: existing.id,
    meta: { tag: [PRACTICE_MANAGED_TAG] },
  };

  console.log('Writing updated Questionnaire...');
  await fhirPut(token, 'Questionnaire', existing.id, merged);
  console.log('Done.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
