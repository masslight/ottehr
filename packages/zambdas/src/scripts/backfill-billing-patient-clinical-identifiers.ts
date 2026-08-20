import { Secrets } from 'utils/lib/secrets';
import { createBillingClient } from '../billing/shared';
import { getAuth0Token } from '../shared/getAuth0Token';
import { backfillBillingPatientClinicalIdentifiers } from './backfill-billing-patient-clinical-identifiers.helpers';
import { performEffectWithEnvFile } from './helpers';

async function backfill(config: Secrets): Promise<void> {
  const token = await getAuth0Token(config);
  if (!token) throw new Error('Failed to fetch auth token.');
  const oystehr = createBillingClient(token, config);
  const dryRun = process.argv.includes('--dry-run');
  const pruneStale = process.argv.includes('--prune-stale');
  const stats = await backfillBillingPatientClinicalIdentifiers({
    oystehr,
    dryRun,
    pruneStale,
  });
  console.log(
    `Billing patient clinical identifier backfill ${dryRun ? 'dry run ' : ''}complete: ${stats.examined} examined, ` +
      `${stats.changed} ${dryRun ? 'would change' : 'changed'}, ${stats.alreadyIndexed} already indexed, ` +
      `${stats.skipped} skipped, ${stats.failed} failed ` +
      `(${stats.patientsGainingIdentifiers} patients gaining identifiers, ` +
      `${stats.patientsDroppingStaleIdentifiers} patients dropping stale identifiers; ` +
      `of the skipped, ${stats.skippedWithNothingToIndex} with nothing to index, ` +
      `${stats.skippedWithPrunableIdentifiers} needing --prune-stale, ` +
      `${stats.skippedNeedingReview} needing review)`
  );
  if (stats.failed) throw new Error(`Billing patient clinical identifier backfill failed for ${stats.failed} Patients`);
}

performEffectWithEnvFile(backfill).catch((error) => {
  console.error(error);
  process.exit(1);
});
