import { Secrets } from 'utils';
import { backfillOutboundFaxAttempts } from './backfill-outbound-fax-attempts.helpers';
import { createOystehrClientFromConfig, performEffectWithEnvFile } from './helpers';

async function backfill(config: Secrets): Promise<void> {
  const oystehr = await createOystehrClientFromConfig(config);
  const dryRun = process.argv.includes('--dry-run');
  const stats = await backfillOutboundFaxAttempts(oystehr, dryRun);
  const createdLabel = dryRun ? 'would be created' : 'created';
  console.log(
    `Outbound fax backfill ${dryRun ? 'dry run ' : ''}complete: ${stats.examined} examined, ` +
      `${stats.created} ${createdLabel}, ${stats.existing} existing, ${stats.skipped} skipped, ${stats.failed} failed`
  );
  if (stats.failed) throw new Error(`Outbound fax backfill failed for ${stats.failed} Communications`);
}

performEffectWithEnvFile(backfill).catch((error) => {
  console.error(error);
  process.exit(1);
});
