import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { InviteConfig } from './types';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const OTTEHR_ROOT = resolve(__dirname, '../../../');

const ENV_CONFIG_FILES: Record<string, string> = {
  local: 'local.json',
  staging: 'staging.json',
  production: 'production.json',
};

export function resolveProjectId(fallbackId: string): string {
  const args = process.argv.slice(2);
  const envArg = args.find((a) => a.startsWith('--env='));
  const env = envArg ? envArg.slice('--env='.length) : undefined;
  if (!env) return fallbackId;
  const filename = ENV_CONFIG_FILES[env];
  if (!filename) {
    console.error(`ERROR: Unknown env "${env}". Use --env=local, --env=staging, or --env=production.`);
    process.exit(1);
  }
  const cfg = JSON.parse(readFileSync(resolve(OTTEHR_ROOT, 'config/.env', filename), 'utf8'));
  if (!cfg.PROJECT_ID) {
    console.error(`ERROR: PROJECT_ID not found in config/.env/${filename}`);
    process.exit(1);
  }
  console.log(`Using project ID from config/.env/${filename} (${env})`);
  return cfg.PROJECT_ID as string;
}

const API_URL = 'https://project-api.zapehr.com/v1';

export function buildConfig(authToken: string, projectId: string): InviteConfig {
  if (!authToken || !projectId) {
    console.error('ERROR: Fill in AUTH_TOKEN and PROJECT_ID in invite.config.ts — see README.md');
    process.exit(1);
  }
  return { authToken, projectId };
}

export async function apiFetch<T>(path: string, config: InviteConfig, options?: RequestInit): Promise<T> {
  const headers = {
    accept: 'application/json',
    authorization: `Bearer ${config.authToken}`,
    'content-type': 'application/json',
    'x-oystehr-project-id': config.projectId,
    'x-zapehr-project-id': config.projectId,
  };

  const res = await fetch(`${API_URL}${path}`, { headers, ...options });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`API ${options?.method || 'GET'} ${path} failed (${res.status}): ${body}`);
  }

  return res.json() as Promise<T>;
}

export async function getApplicationId(config: InviteConfig): Promise<string> {
  console.log('Fetching EHR app Application ID...');
  const apps = await apiFetch<{ id: string; name: string }[]>('/application', config);
  const ehrApp = apps.find((a) => /EHR/i.test(a.name));

  if (!ehrApp) {
    throw new Error('ERROR: Failed to find an application with "EHR" in its name.');
  }

  console.log(`Application ID: ${ehrApp.id}`);
  return ehrApp.id;
}

export async function fetchRoleMap(config: InviteConfig): Promise<Record<string, string>> {
  const roles = await apiFetch<{ id: string; name: string }[]>('/iam/role', config);
  const roleMap: Record<string, string> = {};

  for (const r of roles) {
    roleMap[r.name] = r.id;
  }

  return roleMap;
}

export async function getRoleIds(config: InviteConfig, roleNames: string[]): Promise<string[]> {
  console.log('Fetching role IDs...');
  const roleMap = await fetchRoleMap(config);
  const missingRoles = roleNames.filter((r) => !roleMap[r]);

  if (missingRoles.length) {
    throw new Error(`ERROR: Missing roles: ${missingRoles.join(', ')}`);
  }

  const roleIds = roleNames.map((r) => roleMap[r]);
  console.log('Roles:');

  for (const r of roleNames) {
    console.log(`  ${r}: ${roleMap[r]}`);
  }

  return roleIds;
}

export async function sendDeveloperInvite(config: InviteConfig, email: string, firstName: string): Promise<void> {
  await apiFetch('/developer/invite', config, {
    method: 'POST',
    body: JSON.stringify({
      practitioner: {
        resourceType: 'Practitioner',
        name: [{ family: 'Dev', given: [firstName] }],
      },
      accessPolicy: {
        rule: [{ resource: ['*'], action: ['*'], effect: 'Allow' }],
      },
      email,
    }),
  });
}

export async function sendUserInvite(
  config: InviteConfig,
  applicationId: string,
  email: string,
  firstName: string,
  lastName: string,
  roleIds: string[],
  npi?: string
): Promise<{ invitationUrl?: string; profile: string; id: string }> {
  return apiFetch('/user/invite', config, {
    method: 'POST',
    body: JSON.stringify({
      applicationId,
      username: email,
      email,
      roles: roleIds,
      resource: {
        resourceType: 'Practitioner',
        name: [{ family: lastName, given: [firstName] }],
        ...(npi && {
          identifier: [
            {
              system: 'http://hl7.org/fhir/sid/us-npi',
              value: npi,
            },
          ],
        }),
      },
      accessPolicy: {
        rule: [
          {
            resource: 'FHIR:Patient:*',
            action: ['FHIR:Read'],
            effect: 'Allow',
          },
        ],
      },
    }),
  });
}

export async function setPasswordWithBrowser(invitationUrl: string, password: string): Promise<void> {
  console.log('\nOpening browser to set password...');
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();

  await page.goto(invitationUrl);
  console.log('Waiting for password form to load...');

  await page.waitForLoadState('networkidle');

  const newPasswordSelector = 'input[name="password"], input[id="password"], input[type="password"]';
  await page.waitForSelector(newPasswordSelector, { timeout: 30000 });

  const passwordFields = await page.$$('input[type="password"]');
  console.log(`Found ${passwordFields.length} password field(s)`);

  if (passwordFields.length >= 2) {
    await passwordFields[0].fill(password);
    await passwordFields[1].fill(password);
    console.log('Filled both password fields');
  } else if (passwordFields.length === 1) {
    await passwordFields[0].fill(password);
    console.log('Filled password field');
  }

  const submitButton = page.locator(
    'button[type="submit"], button:has-text("Reset Password"), button:has-text("Set Password"), button:has-text("Continue"), button:has-text("Save"), button:has-text("Confirm")'
  );

  await submitButton.first().click();
  console.log('Clicked submit button');

  try {
    const confirmField = await page.waitForSelector('input[type="password"]', { timeout: 5000 });
    if (confirmField) {
      const confirmFields = await page.$$('input[type="password"]');
      if (confirmFields.length >= 2) {
        await confirmFields[0].fill(password);
        await confirmFields[1].fill(password);
      } else {
        await confirmField.fill(password);
      }
      console.log('Filled confirmation password');

      const confirmBtn = page.locator(
        'button[type="submit"], button:has-text("Reset Password"), button:has-text("Set Password"), button:has-text("Continue"), button:has-text("Save"), button:has-text("Confirm")'
      );
      await confirmBtn.first().click();
      console.log('Clicked confirm button');
    }
  } catch {
    console.log('INFO: No additional confirmation step detected');
  }

  console.log('Waiting for password change confirmation...');
  await page.locator('text=Password Changed!').waitFor({ timeout: 30000 });

  console.log('\nDone! Password has been set.');
  await browser.close();
}
