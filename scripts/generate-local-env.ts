#!/usr/bin/env npm exec -- tsx

import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

const DEPLOY_DIR = path.resolve(__dirname, '..', 'deploy');
const ROOT_DIR = path.resolve(__dirname, '..');

interface TerraformResource {
  address: string;
  values: {
    content: string;
    filename: string;
  };
}

interface TerraformModule {
  address: string;
  resources: TerraformResource[];
  child_modules?: TerraformModule[];
}

interface TerraformState {
  values: {
    root_module: {
      child_modules?: TerraformModule[];
    };
  };
}

interface EnvTarget {
  address: string;
  outputPath: string;
  label: string;
  required: boolean;
}

function getOttehrAppsModule(state: TerraformState): TerraformModule | undefined {
  return state.values.root_module.child_modules?.find((m) => m.address === 'module.ottehr_apps');
}

function extractResource(module: TerraformModule, address: string): string | undefined {
  return module.resources.find((r) => r.address === address)?.values?.content;
}

function main(): void {
  const environment = process.argv[2] || 'local';

  console.log(`Generating local env files from terraform state (environment: ${environment})`);

  // Initialize terraform and select workspace
  console.log('Initializing terraform...');
  execSync('npm run terraform-init', { cwd: DEPLOY_DIR, stdio: 'pipe' });

  console.log(`Selecting workspace: ${environment}`);
  execSync(`terraform workspace select ${environment}`, { cwd: DEPLOY_DIR, stdio: 'pipe' });

  // Read terraform state
  console.log('Reading terraform state...');
  const stateJson = execSync('terraform show -json', { cwd: DEPLOY_DIR, maxBuffer: 50 * 1024 * 1024 }).toString();
  const state: TerraformState = JSON.parse(stateJson);

  const ottehrApps = getOttehrAppsModule(state);
  if (!ottehrApps) {
    console.error('Error: module.ottehr_apps not found in terraform state');
    process.exit(1);
  }

  const targets: EnvTarget[] = [
    {
      address: 'module.ottehr_apps.local_sensitive_file.ehr_env',
      outputPath: path.join(ROOT_DIR, 'apps', 'ehr', 'env', `.env.${environment}`),
      label: 'EHR',
      required: true,
    },
    {
      address: 'module.ottehr_apps.local_sensitive_file.patient_portal_env',
      outputPath: path.join(ROOT_DIR, 'apps', 'intake', 'env', `.env.${environment}`),
      label: 'Intake',
      required: true,
    },
    {
      address: 'module.ottehr_apps.local_sensitive_file.zambda_secrets_for_local_server[0]',
      outputPath: path.join(ROOT_DIR, 'packages', 'zambdas', '.env', `zambda-secrets-${environment}.json`),
      label: 'Zambdas',
      required: environment === 'local' || environment.startsWith('e2e'),
    },
  ];

  let hasErrors = false;

  for (const target of targets) {
    const content = extractResource(ottehrApps, target.address);

    if (!content) {
      if (target.required) {
        console.error(`⚠ No generated config found for ${target.label}`);
        hasErrors = true;
      } else {
        console.log(`ℹ Generated config not present in terraform state for ${target.label} — skipping`);
      }
      continue;
    }

    // Ensure output directory exists
    fs.mkdirSync(path.dirname(target.outputPath), { recursive: true });
    fs.writeFileSync(target.outputPath, content);

    // Pretty-print JSON files
    if (target.outputPath.endsWith('.json')) {
      try {
        const parsed = JSON.parse(content);
        fs.writeFileSync(target.outputPath, JSON.stringify(parsed, null, 2));
      } catch {
        // Not valid JSON, leave as-is
      }
    }

    console.log(`✅ ${target.label} env written to ${path.relative(ROOT_DIR, target.outputPath)}`);
  }

  if (hasErrors) {
    process.exit(1);
  }

  console.log('Done — local env files generated from terraform state.');
}

main();
