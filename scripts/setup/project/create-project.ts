import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { OYSTEHR_AUTH_TOKEN, PROJECT_ENV, PROJECT_NAME, SENDGRID_AUTH_TOKEN } from './setup.config';

const OTTEHR_ROOT = resolve(new URL('.', import.meta.url).pathname, '../../../');

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
    console.log(`✅ Using provided project_id=${projectId}`);
  } else {
    console.log(`🔄 Creating project "${fullProjectName}" (sandbox=${envCfg.sandbox})...`);
    const project = await req<{ id: string }>('https://platform-api.zapehr.com/v1/project', {
      method: 'POST',
      body: JSON.stringify({
        projectName: fullProjectName,
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
  if (!m2ms.length) throw new Error('No M2M clients returned for project');
  const m2m = m2ms[0];
  console.log(`✅ M2M client: ${m2m.name} (${m2m.clientId})`);

  console.log('🔄 Rotating M2M secret...');
  const { secret } = await req<{ secret: string }>(`https://project-api.zapehr.com/v1/m2m/${m2m.id}/rotate-secret`, {
    method: 'POST',
    body: '{}',
    headers: { 'x-oystehr-project-id': projectId },
  });
  console.log(`✅ Secret rotated`);

  let sendgridApiKey: string | undefined;
  if (!opts.sendgridToken) {
    console.error('⚠️  SENDGRID_AUTH_TOKEN not set — skipping SendGrid API key creation.');
    console.error('   You will need to create the SendGrid API key manually and put it into the env files.');
  } else {
    const sendgridKeyName = `${opts.projectName.trim().replace(/\s+/g, '-')}-${opts.env}`;
    console.log(`🔄 Creating SendGrid API key "${sendgridKeyName}"...`);
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
  console.log('\n🎉 Done!');
  console.log(`   project_id:    ${result.projectId}`);
  console.log(`   client_id:     ${result.clientId}`);
  console.log(`   client_secret: ${result.clientSecret}`);
  if (result.sendgridApiKey) {
    console.log(`   sendgrid_key:  ${result.sendgridApiKey}`);
  }
}
