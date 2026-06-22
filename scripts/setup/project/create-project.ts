import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  OYSTEHR_AUTH_TOKEN,
  PROJECT_DOMAIN_PREFIX,
  PROJECT_ENV,
  PROJECT_NAME,
  SENDGRID_AUTH_TOKEN,
} from './setup.config';

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
  domainPrefix?: string;
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
    console.log(`Checking for existing project "${fullProjectName}"...`);
    const me = await req<{ projects: { id: string; name: string }[] }>('https://platform-api.zapehr.com/v1/user/me');
    const existing = me.projects.find((p) => p.name === fullProjectName);
    if (existing) {
      projectId = existing.id;
      console.log(`Found existing project "${fullProjectName}" with id: ${projectId}`);
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

  const isProduction = opts.env === 'production';
  const isLocal = opts.env === 'local';

  // Update deploy/<env>.tfvars (create from local.tfvars template if missing)
  const tfvarsPath = resolve(OTTEHR_ROOT, 'deploy', envCfg.tfvars);
  if (!existsSync(tfvarsPath)) {
    const localTfvarsPath = resolve(OTTEHR_ROOT, 'deploy', ENV_MAP.local.tfvars);
    const template = readFileSync(localTfvarsPath, 'utf8').replace(
      /environment\s*=\s*"[^"]*"/,
      `environment = "${opts.env}"`
    );
    writeFileSync(tfvarsPath, template);
    console.log(`Created ${tfvarsPath} from local.tfvars template`);
  }
  let tfvars = readFileSync(tfvarsPath, 'utf8');
  tfvars = replaceTfvar(tfvars, 'project_id', projectId);
  tfvars = replaceTfvar(tfvars, 'client_id', m2m.clientId);
  tfvars = replaceTfvar(tfvars, 'client_secret', secret);

  if (!isLocal && opts.domainPrefix) {
    const envSubdomainTf = isProduction ? '' : 'staging-';
    const p = opts.domainPrefix;
    tfvars = replaceTfvar(tfvars, 'aws_profile', 'hosted-ottehr');
    tfvars = replaceTfvar(tfvars, 'ehr_domain', `${envSubdomainTf}${p}-ehr.ottehr.com`);
    tfvars = replaceTfvar(tfvars, 'patient_portal_domain', `${envSubdomainTf}${p}.ottehr.com`);
    tfvars = replaceTfvar(tfvars, 'ehr_cert_domain', '*.ottehr.com');
    tfvars = replaceTfvar(tfvars, 'patient_portal_cert_domain', '*.ottehr.com');
  }

  writeFileSync(tfvarsPath, tfvars);
  console.log(`Updated ${tfvarsPath}`);

  // Update config/.env/<env>.json
  const configEnvPath = resolve(OTTEHR_ROOT, 'config/.env', envCfg.zambdaEnv);
  const configEnv = JSON.parse(readFileSync(configEnvPath, 'utf8'));

  const projectNameKebab = opts.projectName.toLowerCase().replace(/\s+/g, '-');
  const prefix = opts.domainPrefix;
  const envSubdomain = isProduction ? '' : 'staging-';
  const patientDomain = prefix ? `${envSubdomain}${prefix}.ottehr.com` : undefined;
  const ehrDomain = prefix ? `${envSubdomain}${prefix}-ehr.ottehr.com` : undefined;

  // Auth / project identity
  configEnv.AUTH0_CLIENT = m2m.clientId;
  configEnv.AUTH0_SECRET = secret;
  configEnv.PROJECT_ID = projectId;
  configEnv['project-name'] = opts.projectName;

  // App display names
  configEnv.EHR_APP_NAME = `${opts.projectName} EHR`;
  configEnv.PATIENT_APP_NAME = `${opts.projectName} Patient`;
  configEnv.EHR_ORGANIZATION_NAME_LONG = opts.projectName;
  configEnv.EHR_ORGANIZATION_NAME_SHORT = opts.projectName;

  // Domain-based URLs (staging + production only)
  if (!isLocal && patientDomain && ehrDomain) {
    configEnv.WEBSITE_URL = `https://${patientDomain}`;
    configEnv.PATIENT_LOGIN_REDIRECT_URL = `https://${patientDomain}/patients`;
    configEnv.PATIENT_ALLOWED_URL_1 = `https://${patientDomain}/`;
    configEnv.PATIENT_ALLOWED_URL_2 = `https://${patientDomain}/patients`;
    configEnv.PATIENT_ALLOWED_URL_3 = `https://${patientDomain}/redirect`;
    configEnv.PATIENT_ALLOWED_URL_4 = `https://${patientDomain}/todo`;
    configEnv.PROVIDER_LOGIN_REDIRECT_URL = `https://${ehrDomain}/`;
    configEnv.PROVIDER_ALLOWED_URL_1 = `https://${ehrDomain}/`;
    configEnv.PROVIDER_ALLOWED_URL_2 = `https://${ehrDomain}/visits`;
  }

  // Lab config
  configEnv['lab-autolab-account-number'] = `${projectNameKebab}-${opts.env}`;
  configEnv['lab-autolab-lab-id'] = isProduction
    ? '713d14ef-c30a-4b9a-a13a-4ad4648ff3ed'
    : '790b282d-77e9-4697-9f59-0cef8238033a';

  // Candid
  configEnv.CANDID_ENV = isProduction ? 'PROD' : 'STAGING';
  configEnv.CANDID_CLIENT_ID = 'TODO';
  configEnv.CANDID_CLIENT_SECRET = 'TODO';

  // Stripe
  configEnv.STRIPE_PUBLIC_KEY = 'TODO';
  configEnv.STRIPE_SECRET_KEY = 'TODO';

  // Advapacs
  configEnv.ADVAPACS_CLIENT_ID = 'TODO';
  configEnv.ADVAPACS_CLIENT_SECRET = 'TODO';
  configEnv.ADVAPACS_WEBHOOK_SECRET = 'TODO';

  // Google
  configEnv.GOOGLE_CLOUD_API_KEY = 'TODO';
  configEnv.GOOGLE_PLACES_API_KEY = 'TODO';

  // SendGrid
  if (sendgridApiKey) {
    configEnv.SENDGRID_API_KEY = sendgridApiKey;
    configEnv.SENDGRID_SEND_EMAIL_API_KEY = sendgridApiKey;
  } else {
    configEnv.SENDGRID_API_KEY = 'TODO';
    configEnv.SENDGRID_SEND_EMAIL_API_KEY = 'TODO';
  }

  // Remove keys that must not be auto-populated
  delete configEnv.ANTHROPIC_API_KEY;

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
  void (async () => {
    const result = await createProject({
      projectName: PROJECT_NAME,
      domainPrefix: PROJECT_DOMAIN_PREFIX || undefined,
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
  })().catch((err) => {
    console.error('ERROR:', err.message || err);
    process.exit(1);
  });
}
