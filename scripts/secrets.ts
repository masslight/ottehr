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

interface ZambdasConfig extends PathConfig {
  sentry: PathConfig;
}

interface TerraformConfig extends PathConfig {
  backend: PathConfig;
}

interface GetFilePathConfig {
  zambdas: ZambdasConfig;
  ehr: PathConfig;
  patientPortal: PathConfig;
  terraform: TerraformConfig;
}

function getFilePaths(environment: string): GetFilePathConfig {
  const repoRoot = process.cwd();
  const secretsPath = path.join(repoRoot, 'secrets');
  return {
    zambdas: {
      source: path.join(secretsPath, 'zambdas', `${environment}.json`),
      target: path.join(repoRoot, 'packages', 'zambdas', '.env', `${environment}.json`),
      sentry: {
        source: path.join(secretsPath, 'zambdas', '.env.sentry-build-plugin'),
        target: path.join(repoRoot, 'packages', 'zambdas', '.env.sentry-build-plugin'),
      },
    },
    ehr: {
      source: path.join(secretsPath, 'ehr', 'app', `.env.${environment}`),
      target: path.join(repoRoot, 'apps', 'ehr', 'env', `.env.${environment}`),
    },
    patientPortal: {
      source: path.join(secretsPath, 'intake', 'app', `.env.${environment}`),
      target: path.join(repoRoot, 'apps', 'intake', 'env', `.env.${environment}`),
    },
    terraform: {
      source: path.join(secretsPath, 'terraform', `${environment}.tfvars`),
      target: path.join(repoRoot, 'deploy', `${environment}.tfvars`),
      backend: {
        source: path.join(secretsPath, 'terraform', 'backend.config'),
        target: path.join(repoRoot, 'deploy', 'backend.config'),
      },
    },
  };
}

function populate(environment: string): void {
  const repoRoot = process.cwd();
  const secretsPath = path.join(repoRoot, 'secrets');
  const paths = getFilePaths(environment);

  if (!checkDirectory(secretsPath)) {
    console.error('Error: secrets directory not found in repository root');
    process.exit(1);
  }

  try {
    if (fs.existsSync(paths.zambdas.source)) {
      fs.mkdirSync(path.dirname(paths.zambdas.target), { recursive: true });
      fs.copyFileSync(paths.zambdas.source, paths.zambdas.target);
      console.log(`Successfully copied ${environment}.json to packages/zambdas/.env`);
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
    if (fs.existsSync(paths.patientPortal.source)) {
      fs.mkdirSync(path.dirname(paths.patientPortal.target), { recursive: true });
      fs.copyFileSync(paths.patientPortal.source, paths.patientPortal.target);
      console.log(`Successfully copied .env.${environment} to packages/intake/env`);
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
  if (!environment) {
    console.error('Error: environment parameter is required for populate command');
    process.exit(1);
  }

  switch (command) {
    case 'populate':
      populate(environment);
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
