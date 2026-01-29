/**
 * Check if the current repository is the main ottehr repository.
 * SSN field is only available in the main repository (masslight/ottehr).
 * Downstream repositories do not have this field.
 *
 * This function reads the IS_MAIN_OTTEHR_REPO environment variable
 * which is set by the run-e2e.ts script.
 */
export function isMainOttehrRepository(): boolean {
  return process.env.IS_MAIN_OTTEHR_REPO === 'true';
}
