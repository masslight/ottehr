#!/usr/bin/env node

const { execSync } = require('child_process');
const fs = require('fs');

function setOutput(key, value) {
  const output = `${key}=${value}\n`;
  fs.appendFileSync(process.env.GITHUB_OUTPUT, output);
}

function main() {
  const paths = process.argv.slice(2);
  
  if (paths.length === 0) {
    console.error('Usage: node check-changes.js <path1> <path2> ...');
    console.error('Example: node check-changes.js apps/ehr/ packages/zambdas/');
    process.exit(2);
  }

  console.log('Checking paths:', paths);

  // For workflow_dispatch events, always run tests
  if (process.env.GITHUB_EVENT_NAME === 'workflow_dispatch') {
    console.log('Workflow dispatch detected - running tests');
    setOutput('should-run', 'true');
    setOutput('skip-reason', '');
    return;
  }

  // Get changed files
  let changedFiles;

  try {
    const output = execSync('git diff --name-only HEAD~ HEAD', { encoding: 'utf8' });
    changedFiles = output.trim().split('\n').filter(file => file.length > 0);
  } catch (error) {
    console.error('Error getting changed files:', error.message);
    // Safe default - assume changes are relevant
    setOutput('should-run', 'true');
    setOutput('skip-reason', '');
    return;
  }

  console.log('Changed files count:', changedFiles.length);

  // Check if any changed file matches provided patterns
  let hasRelevantChanges = false;

  for (const file of changedFiles) {
    for (const pattern of paths) {
      if (file.startsWith(pattern)) {
        console.log(`Found relevant change: ${file} matches pattern ${pattern}*`);
        hasRelevantChanges = true;
        break;
      }
    }
    if (hasRelevantChanges) break;
  }

  if (hasRelevantChanges) {
    console.log('Found relevant changes - running tests');
    setOutput('should-run', 'true');
    setOutput('skip-reason', '');
  } else {
    console.log('No relevant changes - skipping tests');
    setOutput('should-run', 'false');
    setOutput('skip-reason', 'No relevant changes found');
  }
}

main();
