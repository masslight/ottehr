import { Secrets } from 'utils/lib/secrets';
import { createBillingClient, createEraReadClient } from '../billing/shared';
import { getAuth0Token } from '../shared/getAuth0Token';
import { backfillClaimStatusHistory } from './backfill-claim-status-history.helpers';
import { performEffectWithEnvFile } from './helpers';

async function backfill(config: Secrets): Promise<void> {
  const token = await getAuth0Token(config);
  if (!token) throw new Error('Failed to fetch auth token.');
  const dryRun = process.argv.includes('--dry-run');
  const stats = await backfillClaimStatusHistory({
    // Status responses are untagged until the subscription processes them, so they are read with the
    // untagged client and written with the billing one — the same split the subscription uses.
    projectClient: createEraReadClient(token, config),
    billingClient: createBillingClient(token, config),
    secrets: config,
    dryRun,
  });
  console.log(
    `Claim status history backfill ${dryRun ? 'dry run ' : ''}complete: ${stats.examined} examined, ` +
      `${stats.processed} ${dryRun ? 'would be processed' : 'processed'}, ${stats.skipped} skipped, ` +
      `${stats.failed} failed`
  );
  if (stats.failed) throw new Error(`Claim status history backfill failed for ${stats.failed} ClaimResponses`);
}

performEffectWithEnvFile(backfill).catch((error) => {
  console.error(error);
  process.exit(1);
});
