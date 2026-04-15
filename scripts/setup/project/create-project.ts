import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { OYSTEHR_AUTH_TOKEN, PROJECT_ENV, PROJECT_NAME, SENDGRID_AUTH_TOKEN } from './setup.config';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const OTTEHR_ROOT = resolve(__dirname, '../../../');

export type ProjectEnv = 'local' | 'staging' | 'production';

export const ENV_MAP = {
  local: { tfvars: 'local.tfvars', zambdaEnv: 'local.json', label: 'Local', sandbox: true },
  staging: { tfvars: 'staging.tfvars', zambdaEnv: 'staging.json', label: 'Staging', sandbox: true },
  production: { tfvars: 'production.tfvars', zambdaEnv: 'production.json', label: 'Production', sandbox: false },
} as const;

export interface CreateProjectOptions {
  projectName: string;
  env: ProjectEnv;
  oystehrToken: string;
  sendgridToken?: string;
  existingProjectId?: string;
}

export interface CreateProjectResult {
  projectId: string;
  clientId: string;
  clientSecret: string;
  sendgridApiKey?: string;
}

function buildReq(token: string) {
  const authHeaders = { authorization: `Bearer ${token}` };
  return async function req<T>(url: string, init?: RequestInit): Promise<T> {
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
  };
}

function replaceTfvar(content: string, key: string, value: string): string {
  const re = new RegExp(`^(\\s*${key}\\s*=\\s*)"[^"]*"`, 'm');
  if (!re.test(content)) {
    return content + `\n${key} = "${value}"\n`;
  }
  return content.replace(re, `$1"${value}"`);
}

export async function createProject(opts: CreateProjectOptions): Promise<CreateProjectResult> {
  const envCfg = ENV_MAP[opts.env];
  if (!envCfg) {
    throw new Error(`PROJECT_ENV must be one of: local, staging, production (got "${opts.env}")`);
  }
  if (!opts.oystehrToken) {
    throw new Error('OYSTEHR_AUTH_TOKEN is required');
  }
  if (!opts.projectName) {
    throw new Error('PROJECT_NAME is required');
  }

  const fullProjectName = `${opts.projectName} ${envCfg.label}`;
  const req = buildReq(opts.oystehrToken);

  let projectId: string;
  if (opts.existingProjectId) {
    projectId = opts.existingProjectId;
    console.log(`Using provided project_id=${projectId}`);
  } else {
    console.log(`Creating project "${fullProjectName}" (sandbox=${envCfg.sandbox})...`);
    const project = await req<{ id: string }>('https://platform-api.zapehr.com/v1/project', {
      method: 'POST',
      body: JSON.stringify({
        projectName: fullProjectName,
        fhirVersion: 'r4',
        sandbox: envCfg.sandbox,
      }),
    });
    projectId = project.id;
    console.log(`Project created with id: ${projectId}`);
  }

  console.log('Listing M2M clients...');
  const m2ms = await req<{ id: string; clientId: string; name: string }[]>('https://project-api.zapehr.com/v1/m2m', {
    headers: { 'x-oystehr-project-id': projectId },
  });
  if (!m2ms.length) throw new Error('No M2M clients returned for project');
  const m2m = m2ms[0];
  console.log(`Found M2M client: ${m2m.name} (${m2m.clientId})`);

  console.log('Rotating M2M secret...');
  const { secret } = await req<{ secret: string }>(`https://project-api.zapehr.com/v1/m2m/${m2m.id}/rotate-secret`, {
    method: 'POST',
    body: '{}',
    headers: { 'x-oystehr-project-id': projectId },
  });
  console.log('Secret rotated successfully');

  let sendgridApiKey: string | undefined;
  if (!opts.sendgridToken) {
    console.warn('WARNING: SENDGRID_AUTH_TOKEN not set, skipping SendGrid API key creation.');
    console.warn('         You will need to create the SendGrid API key manually.');
  } else {
    const sendgridKeyName = `${opts.projectName.trim().replace(/\s+/g, '-')}-${opts.env}`;
    console.log(`Creating SendGrid API key "${sendgridKeyName}"...`);
    const sgRes = await fetch('https://api.sendgrid.com/v3/api_keys', {
      method: 'POST',
      headers: {
        authorization: `token ${opts.sendgridToken}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ scopes: ['mail.send'], name: sendgridKeyName }),
    });
    if (!sgRes.ok) {
      throw new Error(`SendGrid create key failed (${sgRes.status}): ${await sgRes.text()}`);
    }
    ({ api_key: sendgridApiKey } = (await sgRes.json()) as { api_key: string });
    console.log('SendGrid API key created');
  }

  // Update deploy/<env>.tfvars
  const tfvarsPath = resolve(OTTEHR_ROOT, 'deploy', envCfg.tfvars);
  let tfvars = readFileSync(tfvarsPath, 'utf8');
  tfvars = replaceTfvar(tfvars, 'project_id', projectId);
  tfvars = replaceTfvar(tfvars, 'client_id', m2m.clientId);
  tfvars = replaceTfvar(tfvars, 'client_secret', secret);
  writeFileSync(tfvarsPath, tfvars);
  console.log(`Updated ${tfvarsPath}`);

  // Update config/.env/<env>.json
  const configEnvPath = resolve(OTTEHR_ROOT, 'config/.env', envCfg.zambdaEnv);
  const configEnv = JSON.parse(readFileSync(configEnvPath, 'utf8'));
  configEnv.AUTH0_CLIENT = m2m.clientId;
  configEnv.AUTH0_SECRET = secret;
  configEnv.PROJECT_ID = projectId;
  configEnv['project-name'] = opts.projectName;
  configEnv['lab-autolab-account-number'] = `${opts.projectName.toLowerCase().replace(/\s+/g, '-')}-${opts.env}`;

  // Set SendGrid API key or placeholder
  if (sendgridApiKey) {
    configEnv.SENDGRID_API_KEY = sendgridApiKey;
    configEnv.SENDGRID_SEND_EMAIL_API_KEY = sendgridApiKey;
  } else {
    configEnv.SENDGRID_API_KEY = 'API_KEY';
    configEnv.SENDGRID_SEND_EMAIL_API_KEY = 'API_KEY';
  }

  // Remove optional API keys that should not be auto-populated
  delete configEnv.ANTHROPIC_API_KEY;
  delete configEnv.GOOGLE_CLOUD_API_KEY;

  writeFileSync(configEnvPath, JSON.stringify(configEnv, null, 2) + '\n');
  console.log(`Updated ${configEnvPath}`);

  // Validate that files were updated correctly
  console.log('\nValidating updated files...');

  // Validate tfvars
  const updatedTfvars = readFileSync(tfvarsPath, 'utf8');
  if (!updatedTfvars.includes(projectId)) {
    throw new Error(`Failed to update project_id in ${tfvarsPath}`);
  }
  if (!updatedTfvars.includes(m2m.clientId)) {
    throw new Error(`Failed to update client_id in ${tfvarsPath}`);
  }
  console.log(`  ${envCfg.tfvars}: project_id, client_id, client_secret verified`);

  // Validate config env
  const updatedConfigEnv = JSON.parse(readFileSync(configEnvPath, 'utf8'));
  if (updatedConfigEnv.PROJECT_ID !== projectId) {
    throw new Error(`Failed to update PROJECT_ID in ${configEnvPath}`);
  }
  if (updatedConfigEnv['project-name'] !== opts.projectName) {
    throw new Error(`Failed to update project-name in ${configEnvPath}`);
  }
  if (
    updatedConfigEnv['lab-autolab-account-number'] !==
    `${opts.projectName.toLowerCase().replace(/\s+/g, '-')}-${opts.env}`
  ) {
    throw new Error(`Failed to update lab-autolab-account-number in ${configEnvPath}`);
  }
  console.log(`  ${envCfg.zambdaEnv}: PROJECT_ID, project-name, lab-autolab-account-number verified`);

  return { projectId, clientId: m2m.clientId, clientSecret: secret, sendgridApiKey };
}

// CLI entry — only runs when invoked directly
const isCli = import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith('create-project.ts');
if (isCli) {
  const result = await createProject({
    projectName: PROJECT_NAME,
    env: PROJECT_ENV,
    oystehrToken: OYSTEHR_AUTH_TOKEN,
    sendgridToken: SENDGRID_AUTH_TOKEN,
    existingProjectId: process.env.PROJECT_ID || process.argv[2],
  });
  console.log('\nProject setup complete.');
  console.log(`  project_id:    ${result.projectId}`);
  console.log(`  client_id:     ${result.clientId}`);
  console.log(`  client_secret: ${result.clientSecret}`);
  if (result.sendgridApiKey) {
    console.log(`  sendgrid_key:  ${result.sendgridApiKey}`);
  }
}
