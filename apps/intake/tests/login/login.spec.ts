import fs from 'fs/promises';
import { execSync, exec } from 'child_process';
import path, { dirname } from 'path';
import { fileURLToPath } from 'url';
import { test, expect } from '@playwright/test';
import { login } from 'test-utils';

test('Should log in if not authorized', async ({ context, page }) => {
  try {
    await page.goto('/home');

    try {
      await page.getByRole('button', { name: 'Start a Virtual Visit' }).click();
      await expect(page.getByRole('heading', { name: 'Select patient', level: 2 })).toBeVisible({ timeout: 15000 });
      console.log('User is already logged in');
      return;
    } catch {
      console.log('User is not logged in, proceeding with login...');
      let successLogin = false;
      let attemptNumber = 0;
      const maxAttempts = 2;

      while (!successLogin && attemptNumber < maxAttempts) {
        try {
          await context.clearCookies();
          await context.clearPermissions();
          await page.goto('/');
          await page.getByRole('button', { name: 'Continue' }).click();
          await login(page, process.env.PHONE_NUMBER, process.env.TEXT_USERNAME, process.env.TEXT_PASSWORD);

          /**
           * Handle the case when a user logs in after being logged out.
           * When a user was previously logged out, the user.json file in the secrets repo
           * becomes outdated. This code updates the repo with fresh login credentials
           * after successful authentication.
           */
          await pushUserJsonToSecretsRepo();

          successLogin = true;
        } catch (error) {
          console.error(error);
          attemptNumber++;
          console.log(`Attempt ${attemptNumber} failed, retrying...`);
          if (attemptNumber === maxAttempts) {
            throw new Error(`Failed after ${maxAttempts} attempts`);
          }
        }
      }
    }
  } catch (error) {
    console.error('Test failed:', error);
    throw error;
  }
});

async function pushUserJsonToSecretsRepo(): Promise<void> {
  try {
    console.log('Pushing user.json to secrets repo');
    const repoUrl = 'git@github.com:masslight/ottehr-secrets.git';
    const repoName = getRepoNameFromUrl(repoUrl);
    if (!repoName) throw new Error('secrets repo name not found');

    const currentDir = process.cwd();
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = dirname(__filename);

    const repoUserJsonPath = path.join(currentDir, repoName, 'intake', 'app');
    const localUserJsonPath = path.join(__dirname, '../../playwright/user.json');

    await cloneRepoLocally(repoUrl);
    await fs.copyFile(localUserJsonPath, path.join(repoUserJsonPath, 'user.json'));
    console.log(`Copied user.json to ${repoUserJsonPath}`);
    const repoPath = path.resolve(currentDir, repoName);

    console.log('repoPath', repoPath);

    try {
      execSync('git add .', { cwd: repoPath });
      try {
        execSync('git diff --quiet && git diff --staged --quiet', { cwd: repoPath });
      } catch {
        execSync('git commit -m "Update user.json from localhost" && git push', { cwd: repoPath });
      }
    } catch (error) {
      console.error(error);
    }
    console.log('user.json pushed to secrets repo');

    await removeFolder(repoPath);
    console.log('Secrets repo removed');
  } catch (error) {
    console.error('push user.json error:', error);
    throw error;
  }
}

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
function removeFolder(path: string) {
  if (!path) {
    return;
  }
  // Remove the cloned repository
  console.log(`Removing folder ${path}...`);
  return new Promise((resolve, reject) => {
    exec(`rm -rf ${path}`, (error) => {
      if (error) {
        console.error(`Error removing folder ${path}: ${error.message}`);
        reject(error);
      }

      console.log(`Removed folder ${path} successfully`);
      resolve(null);
    });
  });
}

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
function cloneRepoLocally(repoUrl: string) {
  return new Promise((resolve, reject) => {
    exec(`git clone ${repoUrl}`, (error) => {
      if (error) {
        console.error(`Error cloning repository: ${error.message}`);
        reject(error);
        return;
      }
      resolve(null);
    });
  });
}

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
function getRepoNameFromUrl(repoUrl: string) {
  const httpsPattern = /(?<=github\.com\/)[^/]+\/([^/]+)(?=\.git)/;
  const sshPattern = /(?<=github\.com:|github\.com\/)[^/]+\/([^/]+)(?=\.git)/;
  const match = repoUrl.match(httpsPattern) || repoUrl.match(sshPattern);

  if (!match) {
    throw new Error('Unsupported repository URL format');
  }

  const repoName = match[1];
  return repoName;
}
