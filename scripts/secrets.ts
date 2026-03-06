#!/usr/bin/env npm exec -- tsx

import * as fs from 'fs';
import * as path from 'path';

function checkDirectory(dirPath: string): boolean {
  try {
    return fs.existsSync(dirPath) && fs.statSync(dirPath).isDirectory();
  } catch {
    return false;
  }
}

interface PathConfig {
  source: string;
  target: string;
}

interface AppConfig extends PathConfig {
  public: PathConfig;
}

interface ZambdasConfig extends PathConfig {
  sentry: PathConfig;
  assets: PathConfig;
}

interface TerraformConfig extends PathConfig {
  backend: PathConfig;
  imports: PathConfig;
}

interface GetFilePathConfig {
  zambdas: ZambdasConfig;
  ehr: AppConfig;
  patientPortal: AppConfig;
  terraform: TerraformConfig;
}

function getFilePaths(environment: string): GetFilePathConfig {
  const repoRoot = process.cwd();
  console.log('Working directory:', repoRoot);
  const secretsPath = path.join(repoRoot, 'secrets');
  console.log('Secrets path:', secretsPath);
  return {
    zambdas: {
      source: path.join(secretsPath, 'zambdas', '.env', `${environment}.json`),
      target: path.join(repoRoot, 'packages', 'zambdas', '.env', `${environment}.json`),
      sentry: {
        source: path.join(secretsPath, 'zambdas', '.env', '.env.sentry-build-plugin'),
        target: path.join(repoRoot, 'packages', 'zambdas', '.env.sentry-build-plugin'),
      },
      assets: {
        source: path.join(secretsPath, 'zambdas', 'assets'),
        target: path.join(repoRoot, 'packages', 'zambdas', 'assets'),
      },
    },
    ehr: {
      source: path.join(secretsPath, 'apps', 'ehr', 'env', `.env.${environment}`),
      target: path.join(repoRoot, 'apps', 'ehr', 'env', `.env.${environment}`),
      public: {
        source: path.join(secretsPath, 'apps', 'ehr', 'public'),
        target: path.join(repoRoot, 'apps', 'ehr', 'public'),
      },
    },
    patientPortal: {
      source: path.join(secretsPath, 'apps', 'intake', 'env', `.env.${environment}`),
      target: path.join(repoRoot, 'apps', 'intake', 'env', `.env.${environment}`),
      public: {
        source: path.join(secretsPath, 'apps', 'intake', 'public'),
        target: path.join(repoRoot, 'apps', 'intake', 'public'),
      },
    },
    terraform: {
      source: path.join(secretsPath, 'terraform', `${environment}.tfvars`),
      target: path.join(repoRoot, 'deploy', `${environment}.tfvars`),
      backend: {
        source: path.join(secretsPath, 'terraform', 'backend.config'),
        target: path.join(repoRoot, 'deploy', 'backend.config'),
      },
      imports: {
        source: path.join(secretsPath, 'terraform', `${environment}_import.tf`),
        target: path.join(repoRoot, 'deploy', `${environment}_import.tf`),
      },
    },
  };
}

function copyConfiguration(project?: string): void {
  const repoRoot = process.cwd();
  const secretsPath = path.join(repoRoot, 'secrets');

  console.log('\n=== Copying configuration files ===');

  // Skip configuration copying for ottehr project
  if (project === 'ottehr') {
    console.log('Skipping configuration copy for ottehr project');
    return;
  }

  // Clear and create target directories for configuration
  const configPaths = [
    { source: path.join(secretsPath, 'configuration', 'oystehr'), target: path.join(repoRoot, 'config', 'oystehr'), type: 'full' },
    { source: path.join(secretsPath, 'configuration', 'sendgrid'), target: path.join(repoRoot, 'config', 'sendgrid'), type: 'full' },
    {
      source: path.join(secretsPath, 'configuration', 'ottehr-config-overrides'),
      target: path.join(repoRoot, 'packages', 'utils', 'ottehr-config-overrides'),
      type: 'selective',
    },
  ];

  configPaths.forEach(({ source, target, type }) => {
    if (type === 'full') {
      // Remove existing directory and create fresh one
      if (fs.existsSync(target)) {
        fs.rmSync(target, { recursive: true, force: true });
      }
      fs.mkdirSync(target, { recursive: true });

      // Copy if source exists
      if (fs.existsSync(source)) {
        fs.cpSync(source, target, { recursive: true });
        console.log(
          `✓ Copied configuration from ${path.relative(repoRoot, source)} to ${path.relative(repoRoot, target)}`
        );
      } else {
        console.log(`⚠ Configuration directory not found: ${path.relative(repoRoot, source)}`);
      }
    } else if (type === 'selective') {
      // For ottehr-config-overrides: only replace directories that exist in both target and source
      if (!fs.existsSync(source)) {
        console.log(`⚠ Configuration directory not found: ${path.relative(repoRoot, source)}`);
        return;
      }

      // Ensure target directory exists
      if (!fs.existsSync(target)) {
        console.log(`⚠ Target directory not found: ${path.relative(repoRoot, target)}`);
        return;
      }

      // Read all items in target directory (working copy)
      const targetItems = fs.readdirSync(target, { withFileTypes: true });
      
      targetItems.forEach(item => {
        const sourcePath = path.join(source, item.name);
        const targetPath = path.join(target, item.name);

        if (item.isDirectory() && fs.existsSync(sourcePath)) {
          // Only replace if the directory also exists in source
          fs.rmSync(targetPath, { recursive: true, force: true });
          fs.cpSync(sourcePath, targetPath, { recursive: true });
          console.log(`✓ Replaced override directory: ${item.name}`);
        } else if (item.isDirectory()) {
          console.log(`⚠ Skipping directory (not in secrets): ${item.name}`);
        }
      });
      
      console.log(
        `✓ Selectively copied ottehr-config-overrides from ${path.relative(repoRoot, source)} to ${path.relative(repoRoot, target)}`
      );
    }
  });
}

function populate(environment: string, project?: string): void {
  const repoRoot = process.cwd();
  const secretsPath = path.join(repoRoot, 'secrets');
  const paths = getFilePaths(environment);

  if (!checkDirectory(secretsPath)) {
    console.error('Error: secrets directory not found in repository root');
    process.exit(1);
  }

  // Copy configuration files first
  copyConfiguration(project);

  console.log('\n=== Populating environment-specific secrets ===');

  try {
    if (fs.existsSync(paths.zambdas.source)) {
      fs.mkdirSync(path.dirname(paths.zambdas.target), { recursive: true });
      fs.copyFileSync(paths.zambdas.source, paths.zambdas.target);
      console.log(`Successfully copied ${environment}.json to packages/zambdas/.env`);
    }
    if (fs.existsSync(paths.zambdas.assets.source)) {
      fs.mkdirSync(paths.zambdas.assets.target, { recursive: true });
      fs.cpSync(paths.zambdas.assets.source, paths.zambdas.assets.target, { recursive: true });
      console.log(`Successfully copied assets to packages/zambdas/assets`);
    }
    if (environment !== 'local' && fs.existsSync(paths.zambdas.sentry.source)) {
      // No sentry config for local environment
      fs.mkdirSync(path.dirname(paths.zambdas.sentry.target), { recursive: true });
      fs.copyFileSync(paths.zambdas.sentry.source, paths.zambdas.sentry.target);
      console.log(`Successfully copied .env.sentry-build-plugin to packages/zambdas/.env`);
    }
    if (fs.existsSync(paths.ehr.source)) {
      fs.mkdirSync(path.dirname(paths.ehr.target), { recursive: true });
      fs.copyFileSync(paths.ehr.source, paths.ehr.target);
      console.log(`Successfully copied .env.${environment} to packages/ehr/env`);
    }
    if (fs.existsSync(paths.ehr.public.source)) {
      fs.mkdirSync(paths.ehr.public.target, { recursive: true });
      fs.cpSync(paths.ehr.public.source, paths.ehr.public.target, { recursive: true });
      console.log(`Successfully copied public assets to packages/ehr/public`);
    }
    if (fs.existsSync(paths.patientPortal.source)) {
      fs.mkdirSync(path.dirname(paths.patientPortal.target), { recursive: true });
      fs.copyFileSync(paths.patientPortal.source, paths.patientPortal.target);
      console.log(`Successfully copied .env.${environment} to packages/intake/env`);
    }
    if (fs.existsSync(paths.patientPortal.public.source)) {
      fs.mkdirSync(paths.patientPortal.public.target, { recursive: true });
      fs.cpSync(paths.patientPortal.public.source, paths.patientPortal.public.target, { recursive: true });
      console.log(`Successfully copied public assets to packages/intake/public`);
    }
    if (fs.existsSync(paths.terraform.source)) {
      fs.mkdirSync(path.dirname(paths.terraform.target), { recursive: true });
      fs.copyFileSync(paths.terraform.source, paths.terraform.target);
      console.log(`Successfully copied ${environment}.tfvars to deploy`);
    }
    if (fs.existsSync(paths.terraform.backend.source)) {
      fs.mkdirSync(path.dirname(paths.terraform.backend.target), { recursive: true });
      fs.copyFileSync(paths.terraform.backend.source, paths.terraform.backend.target);
      console.log(`Successfully copied backend.config to deploy`);
    }
    if (fs.existsSync(paths.terraform.imports.source)) {
      fs.mkdirSync(path.dirname(paths.terraform.imports.target), { recursive: true });
      fs.copyFileSync(paths.terraform.imports.source, paths.terraform.imports.target);
      console.log(`Successfully copied ${environment}_import.tf to deploy`);
    }
  } catch (error) {
    console.error('Error copying files:', error);
    process.exit(1);
  }
}

function validate(environment: string): void {
  const paths = getFilePaths(environment);
  const missingFiles: string[] = [];

  [
    { path: paths.zambdas.target, name: 'Zambdas config' },
    ...(environment !== 'local' ? [{ path: paths.zambdas.sentry.target, name: 'Zambdas Sentry config' }] : []),
    { path: paths.ehr.target, name: 'EHR env' },
    { path: paths.patientPortal.target, name: 'Patient Portal env' },
    { path: paths.terraform.target, name: 'Terraform vars' },
    { path: paths.terraform.backend.target, name: 'Terraform backend config' },
  ].forEach(({ path: filePath, name }) => {
    if (!fs.existsSync(filePath)) {
      missingFiles.push(`${name} at ${filePath}`);
    }
  });

  if (missingFiles.length > 0) {
    console.error('Error: The following configuration files are missing:');
    missingFiles.forEach((file) => console.error(`- ${file}`));
    process.exit(1);
  }
}

function main(): void {
  const command = process.argv[2];
  const environment = process.argv[3];
  const project = process.argv[4];
  
  if (!environment) {
    console.error('Error: environment parameter is required');
    console.error('Usage: tsx scripts/secrets.ts <command> <environment> [project]');
    process.exit(1);
  }

  switch (command) {
    case 'populate':
      populate(environment, project);
      break;
    case 'validate':
      validate(environment);
      break;
    default:
      console.error('Invalid command. Valid commands are: populate, validate');
      process.exit(1);
  }
}

main();
