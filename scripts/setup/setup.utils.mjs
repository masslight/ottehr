import { exec } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
function removeFolder(path) {
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
      resolve();
    });
  });
}

// Function to check if a directory exists and is not empty
// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
function isDirectoryExistsAndNotEmpty(dirPath) {
  try {
    const files = fs.readdirSync(dirPath);
    return files.length > 0;
  } catch (err) {
    return false;
  }
}

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
function cloneRepoLocally(repoUrl) {
  return new Promise((resolve, reject) => {
    exec(`git clone ${repoUrl}`, (error) => {
      if (error) {
        console.error(`Error cloning repository: ${error.message}`);
        reject(error);
        return;
      }
      resolve();
    });
  });
}

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
function getRepoNameFromUrl(repoUrl) {
  const httpsPattern = /(?<=github\.com\/)[^/]+\/([^/]+)(?=\.git)/;
  const sshPattern = /(?<=github\.com:|github\.com\/)[^/]+\/([^/]+)(?=\.git)/;
  const match = repoUrl.match(httpsPattern) || repoUrl.match(sshPattern);

  if (!match) {
    throw new Error('Unsupported repository URL format');
  }

  const repoName = match[1];
  return repoName;
}

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
async function loadEnvFilesFromRepo(repoUrl, filesToCopyParamsArray) {
  const repoName = getRepoNameFromUrl(repoUrl);
  let someEnvMissing = false;
  filesToCopyParamsArray.forEach((params) => {
    console.log(params);
    const { localEnvFolder, _, envsToCopy } = params;
    console.log(`Checking if ${localEnvFolder} exists and not empty`);
    if (isDirectoryExistsAndNotEmpty(localEnvFolder)) {
      envsToCopy.forEach((env) => {
        if (!fs.existsSync(path.join(localEnvFolder, `${env}`))) {
          console.log(`${env} json env file doesn't exist in this folder`);
          someEnvMissing = true;
          return;
        }
      });
    } else {
      console.log(`Folder missing ${localEnvFolder}`);
      someEnvMissing = true;
    }
  });

  if (!someEnvMissing) {
    console.log('Env files already exist. Skipping cloning secrets repo and copying env files.');

    await removeFolder(repoName);
    return;
  }

  await removeFolder(repoName);
  await cloneRepoLocally(repoUrl);

  filesToCopyParamsArray.forEach((params) => {
    const { localEnvFolder, repoEnvFolder, envsToCopy } = params;

    if (!fs.existsSync(localEnvFolder)) {
      fs.mkdirSync(localEnvFolder);
    }

    // Copy files from downloaded repo folder to local folder
    envsToCopy.forEach((env) => {
      const sourceEnvFile = path.join(repoEnvFolder, `${env}`);
      const destinationEnvFile = path.join(localEnvFolder, `${env}`);

      if (fs.existsSync(sourceEnvFile)) {
        try {
          if (!fs.existsSync(destinationEnvFile)) {
            fs.copyFileSync(sourceEnvFile, destinationEnvFile);
            console.log(`Copied ${env} successfully to ${destinationEnvFile}`);
          } else {
            console.log(`File ${destinationEnvFile} already exists. Skipping.`);
          }
        } catch (err) {
          console.error(`Error copying ${env}: ${err.message}`);
        }
      } else {
        console.log(`${env} does not exist in the source folder. Skipping.`);
      }
    });
  });

  await removeFolder(repoName);
}

export default {
  removeFolder,
  isDirectoryExistsAndNotEmpty,
  loadEnvFilesFromRepo,
  cloneRepoLocally,
  getRepoNameFromUrl,
};
