/**
 * Path configuration for automatic CI job triggering in GitHub Actions
 * 
 * This file defines which file changes should trigger workflows for each application.
 * Used by check-changed-files.js to determine if jobs should run based on git diff.
 *
 * Structure:
 * - common: shared paths that affect all applications (packages, configs, etc.)
 * - intake: paths specific to Intake app
 * - ehr: paths specific to EHR app
 * - getPaths(): utility function to combine app-specific + common paths
 *
 * Usage in workflows:
 *   TRACKED_FILES=$(node -e "
 *     const config = require('./.github/trigger-paths.js');
 *     console.log(config.getPaths('intake').join(' '));
 *   ")
 *   node .github/check-changed-files.js $TRACKED_FILES
 */

module.exports = {
  common: [
    'packages/zambdas/',
    'packages/utils/',
    'packages/ui-components/',
    '.github/',
    '.prettierignore',
    'package.json'
  ],
  
  intake: [
    'apps/intake/'
  ],
  
  ehr: [
    'apps/ehr/'
  ],
  
  // get all paths for a specific app
  getPaths(appName) {
    if (!this[appName]) {
      throw new Error(`App "${appName}" not found`);
    }
    
    return [...this[appName], ...this.common];
  }
};
