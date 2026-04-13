import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { OYSTEHR_AUTH_TOKEN, PROJECT_ENV, PROJECT_NAME, SENDGRID_AUTH_TOKEN } from './setup.config';

const OTTEHR_ROOT = resolve(new URL('.', import.meta.url).pathname, '../../../');

if (!OYSTEHR_AUTH_TOKEN) {
  console.error('❌ OYSTEHR_AUTH_TOKEN is required in setup.config.ts');
  process.exit(1);
}
if (!PROJECT_NAME) {
  console.error('❌ PROJECT_NAME is required in setup.config.ts');
  process.exit(1);
}

const envMap = {
  local: { tfvars: 'local.tfvars', zambdaEnv: 'local.json', label: 'Local', sandbox: true },
  staging: { tfvars: 'staging.tfvars', zambdaEnv: 'staging.json', label: 'Staging', sandbox: true },
  production: { tfvars: 'production.tfvars', zambdaEnv: 'production.json', label: 'Production', sandbox: false },
} as const;

const envCfg = envMap[PROJECT_ENV];
if (!envCfg) {
  console.error(`❌ PROJECT_ENV must be one of: local, staging, production (got "${PROJECT_ENV}")`);
  process.exit(1);
}

const FULL_PROJECT_NAME = `${PROJECT_NAME} ${envCfg.label}`;
const authHeaders = { authorization: `Bearer ${OYSTEHR_AUTH_TOKEN}` };

async function req<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: {
      ...authHeaders,
      ...(init?.body ? { 'content-type': 'application/json' } : {}),
      ...(init?.headers as Record<string, string> | undefined),
    },
  });
  if (!res.ok) {
    throw new Error(`${init?.method || 'GET'} ${url} failed (${res.status}): ${await res.text()}`);
  }
  return res.json() as Promise<T>;
}

function replaceTfvar(content: string, key: string, value: string): string {
  const re = new RegExp(`^(\\s*${key}\\s*=\\s*)"[^"]*"`, 'm');
  if (!re.test(content)) {
    return content + `\n${key} = "${value}"\n`;
  }
  return content.replace(re, `$1"${value}"`);
}

async function main(): Promise<void> {
  const explicitProjectId = process.env.PROJECT_ID || process.argv[2];
  let projectId: string;
  if (explicitProjectId) {
    projectId = explicitProjectId;
    console.log(`✅ Using provided project_id=${projectId}`);
  } else {
    console.log(`🔄 Creating project "${FULL_PROJECT_NAME}" (sandbox=${envCfg.sandbox})...`);
    const project = await req<{ id: string }>('https://platform-api.zapehr.com/v1/project', {
      method: 'POST',
      body: JSON.stringify({
        projectName: FULL_PROJECT_NAME,
        fhirVersion: 'r4',
        sandbox: envCfg.sandbox,
      }),
    });
    projectId = project.id;
    console.log(`✅ Project created. project_id=${projectId}`);
  }

  console.log('🔄 Listing M2M clients...');
  const m2ms = await req<{ id: string; clientId: string; name: string }[]>('https://project-api.zapehr.com/v1/m2m', {
    headers: { 'x-oystehr-project-id': projectId },
  });
  if (!m2ms.length) throw new Error('No M2M clients returned for new project');
  const m2m = m2ms[0];
  console.log(`✅ M2M client: ${m2m.name} (${m2m.clientId})`);

  console.log('🔄 Rotating M2M secret...');
  const { secret } = await req<{ secret: string }>(`https://project-api.zapehr.com/v1/m2m/${m2m.id}/rotate-secret`, {
    method: 'POST',
    body: '{}',
    headers: { 'x-oystehr-project-id': projectId },
  });
  console.log(`✅ Secret rotated`);

  // Create SendGrid API key (optional)
  let sendgridApiKey: string | undefined;
  if (!SENDGRID_AUTH_TOKEN) {
    console.error('⚠️  SENDGRID_AUTH_TOKEN not set in setup.config.ts — skipping SendGrid API key creation.');
    console.error('   You will need to create the SendGrid API key manually and put it into the env files.');
  } else {
    const sendgridKeyName = `${PROJECT_NAME.trim().replace(/\s+/g, '-')}-${PROJECT_ENV}`;
    console.log(`🔄 Creating SendGrid API key "${sendgridKeyName}"...`);
    const sgRes = await fetch('https://api.sendgrid.com/v3/api_keys', {
      method: 'POST',
      headers: {
        authorization: `token ${SENDGRID_AUTH_TOKEN}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ scopes: ['mail.send'], name: sendgridKeyName }),
    });
    if (!sgRes.ok) {
      throw new Error(`SendGrid create key failed (${sgRes.status}): ${await sgRes.text()}`);
    }
    ({ api_key: sendgridApiKey } = (await sgRes.json()) as { api_key: string });
    console.log(`✅ SendGrid API key created`);
  }

  // Update deploy/<env>.tfvars
  const tfvarsPath = resolve(OTTEHR_ROOT, 'deploy', envCfg.tfvars);
  let tfvars = readFileSync(tfvarsPath, 'utf8');
  tfvars = replaceTfvar(tfvars, 'project_id', projectId);
  tfvars = replaceTfvar(tfvars, 'client_id', m2m.clientId);
  tfvars = replaceTfvar(tfvars, 'client_secret', secret);
  writeFileSync(tfvarsPath, tfvars);
  console.log(`✅ Updated ${tfvarsPath}`);

  // Update packages/zambdas/.env/<env>.json
  const zambdaEnvPath = resolve(OTTEHR_ROOT, 'packages/zambdas/.env', envCfg.zambdaEnv);
  const zambdaEnv = JSON.parse(readFileSync(zambdaEnvPath, 'utf8'));
  zambdaEnv.AUTH0_CLIENT = m2m.clientId;
  zambdaEnv.AUTH0_SECRET = secret;
  zambdaEnv.PROJECT_ID = projectId;
  if (sendgridApiKey) {
    zambdaEnv.SENDGRID_API_KEY = sendgridApiKey;
    zambdaEnv.SENDGRID_SEND_EMAIL_API_KEY = sendgridApiKey;
  }
  writeFileSync(zambdaEnvPath, JSON.stringify(zambdaEnv, null, 2) + '\n');
  console.log(`✅ Updated ${zambdaEnvPath}`);

  console.log('\n🎉 Done!');
  console.log(`   project_id:    ${projectId}`);
  console.log(`   client_id:     ${m2m.clientId}`);
  console.log(`   client_secret: ${secret}`);
  if (sendgridApiKey) {
    console.log(`   sendgrid_key:  ${sendgridApiKey}`);
  }
}

main().catch((err) => {
  console.error('❌ Error:', err.message || err);
  process.exit(1);
});
