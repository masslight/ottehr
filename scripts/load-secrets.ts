import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

const SECRETS_REPO = 'git@github.com:masslight/ottehr-secrets.git';
const SECRETS_DIR = './secrets';
const TEMP_DIR = './secrets-temp';

function exec(command: string, cwd?: string): void {
  execSync(command, { stdio: 'inherit', cwd });
}

function main(): void {
  const args = process.argv.slice(2);
  const projectName = args[0];
  const branchName = args[1] || 'develop';
  const environment = args[2] || 'local';

  if (!projectName) {
    console.error('Error: project_name is required');
    console.error('Usage: npm run load-secrets <project_name> [branch_name] [environment]');
    process.exit(1);
  }

  console.log(`Loading secrets for project: ${projectName} (branch: ${branchName}, environment: ${environment})`);

  // Remove existing secrets and temp directories if they exist
  if (fs.existsSync(SECRETS_DIR)) {
    console.log('Removing existing secrets directory...');
    fs.rmSync(SECRETS_DIR, { recursive: true, force: true });
  }
  if (fs.existsSync(TEMP_DIR)) {
    console.log('Removing existing temp directory...');
    fs.rmSync(TEMP_DIR, { recursive: true, force: true });
  }

  // Clone the secrets repository to temp directory
  console.log('Cloning secrets repository...');
  exec(`git clone ${SECRETS_REPO} ${TEMP_DIR}`);

  // Checkout the specified branch
  console.log(`Checking out branch: ${branchName}`);
  exec(`git checkout ${branchName}`, TEMP_DIR);
  exec(`git pull origin ${branchName}`, TEMP_DIR);

  // Create secrets directory
  fs.mkdirSync(SECRETS_DIR, { recursive: true });

  // Copy project-specific files to secrets directory
  const projectPath = path.join(TEMP_DIR, projectName);
  if (fs.existsSync(projectPath)) {
    console.log(`Copying files from ${projectName} to secrets directory...`);
    fs.cpSync(projectPath, SECRETS_DIR, { recursive: true });
  } else {
    console.error(`Error: Project '${projectName}' not found in secrets repository`);
    fs.rmSync(TEMP_DIR, { recursive: true, force: true });
    process.exit(1);
  }

  // Remove temp directory
  console.log('Cleaning up temporary files...');
  fs.rmSync(TEMP_DIR, { recursive: true, force: true });

  // Run the populate script
  console.log('Running secrets populate script...');
  exec(`npm exec -- tsx ./scripts/secrets.ts populate ${environment} ${projectName}`);

  // Remove .terraform directory to force reinitialization
  const terraformDir = './deploy/.terraform';
  if (fs.existsSync(terraformDir)) {
    console.log('Removing .terraform directory...');
    fs.rmSync(terraformDir, { recursive: true, force: true });
  }

  // Remove secrets directory after populating
  console.log('Removing secrets directory...');
  fs.rmSync(SECRETS_DIR, { recursive: true, force: true });

  console.log(`✅ Secrets loaded successfully for ${projectName}`);
}

main();
