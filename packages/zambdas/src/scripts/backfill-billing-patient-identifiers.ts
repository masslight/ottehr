import { Secrets } from 'utils';
import { createBillingClient } from '../billing/shared';
import { getAuth0Token } from '../shared';
import { backfillBillingPatientIdentifiers } from './backfill-billing-patient-identifiers.helpers';
import { performEffectWithEnvFile } from './helpers';

async function backfill(config: Secrets): Promise<void> {
  const dryRun = process.argv.includes('--dry-run');
  const token = await getAuth0Token(config);
  if (!token) throw new Error('Failed to fetch auth token.');
  const oystehr = createBillingClient(token, config);

  const stats = await backfillBillingPatientIdentifiers(oystehr, dryRun);
  const stampedLabel = dryRun ? 'would be stamped' : 'stamped';
  console.log(
    `Billing patient identifier backfill ${dryRun ? 'dry run ' : ''}complete: ${stats.examined} examined, ` +
      `${stats.stamped} ${stampedLabel}, ${stats.alreadyKeyed} already keyed, ` +
      `${stats.noClinicalSource} without a clinical source, ` +
      `${stats.duplicatesLeftUnmatched} existing duplicate(s) left unmatched, ${stats.failed} failed`
  );
  if (stats.failed) throw new Error(`Billing patient identifier backfill failed for ${stats.failed} Patients`);
}

performEffectWithEnvFile(backfill).catch((error) => {
  console.error(error);
  process.exit(1);
});
