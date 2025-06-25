/**
 * Path configuration for automatic CI job triggering in GitHub Actions
 * 
 * This file defines which file changes should trigger workflows for each application.
 * Used by check-changed-files.js to determine if jobs should run based on git diff.
 *
 * Usage in workflows:
 *   TRACKED_FILES=$(node -e "
 *     const config = require('./.github/trigger-paths.js');
 *     console.log(config.getE2EPaths('intake').join(' '));
 *   ")
 *   node .github/check-changed-files.js $TRACKED_FILES
 */

const fs = require('fs');

const PATHS = {
  rootPackageJson: 'package.json',
  rootPrettierIgnore: '.prettierignore',

  githubDir: '.github/',
  githubIntakeE2EWorkflow: '.github/workflows/e2e-intake.yml',
  githubEhrE2EWorkflow: '.github/workflows/e2e-ehr.yml',

  packageUtilsDir: 'packages/utils/',
  packageUiComponentsDir: 'packages/ui-components/',

  zambdasDir: 'packages/zambdas/',
  zambdasEhrDir: 'packages/zambdas/src/ehr/',
  zambdasPatientDir: 'packages/zambdas/src/patient/',
  zambdasSharedDir: 'packages/zambdas/src/shared/',
  zambdasScriptsDir: 'packages/zambdas/src/scripts/',
  zambdaSubscriptionsDir: 'packages/zambdas/src/subscriptions/',

  intakeAppDir: 'apps/intake/',
  ehrAppDir: 'apps/ehr/',
};

const intakeTriggers = [
  PATHS.intakeAppDir,
  PATHS.zambdasPatientDir,
]

const ehrTriggers = [
  PATHS.ehrAppDir,
  PATHS.zambdasEhrDir,
]

const e2eCommonTriggers = [
  PATHS.rootPackageJson,
  PATHS.packageUtilsDir,
  PATHS.packageUiComponentsDir,
  PATHS.zambdasSharedDir,
  PATHS.zambdasScriptsDir,
  PATHS.zambdaSubscriptionsDir,
];

const e2eIntakeTriggers = [
  ...intakeTriggers,
  ...e2eCommonTriggers,
  PATHS.githubIntakeE2EWorkflow,
]

const e2eEhrTriggers = [
  ...ehrTriggers,
  ...e2eCommonTriggers,
  PATHS.githubEhrE2EWorkflow,
]

Object.values(PATHS).forEach((path) => {
  if (!fs.existsSync(path)) {
    throw Error(`Error: Path "${path}" does not exist`);
  }
});

module.exports = {
  e2e: {
    intake: e2eIntakeTriggers,
    ehr: e2eEhrTriggers,
  },
  
  getE2EPaths(appName) {
    if (!this.e2e[appName]) {
      throw new Error(`App "${appName}" not found in e2e configuration`);
    }
    return this.e2e[appName];
  },
};
