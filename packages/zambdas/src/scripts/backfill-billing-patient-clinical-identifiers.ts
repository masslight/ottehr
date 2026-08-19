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
  const patchedLabel = dryRun ? 'would be patched' : 'patched';
  const prunedLabel = dryRun ? 'would be pruned' : 'pruned';
  console.log(
    `Billing patient clinical identifier backfill ${dryRun ? 'dry run ' : ''}complete: ${stats.examined} examined, ` +
      `${stats.patched} ${patchedLabel}, ${stats.pruned} ${prunedLabel}, ${stats.alreadyIndexed} already indexed, ` +
      `${stats.skipped} skipped, ${stats.failed} failed`
  );
  if (stats.failed) throw new Error(`Billing patient clinical identifier backfill failed for ${stats.failed} Patients`);
}

performEffectWithEnvFile(backfill).catch((error) => {
  console.error(error);
  process.exit(1);
});
