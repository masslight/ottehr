import { Secrets } from 'utils/lib/secrets';
import { backfillImmunizations } from './backfill-immunizations.helpers';
import { createOystehrClientFromConfig, performEffectWithEnvFile } from './helpers';

// One-time backfill: an Immunization record for every vaccine order administered before Immunization records were
// written alongside MedicationAdministrations. Safe to re-run: orders whose Immunization exists are skipped.
//   npm run backfill-immunizations -- <env> [--dry-run]
async function backfill(config: Secrets): Promise<void> {
  const oystehr = await createOystehrClientFromConfig(config);
  const dryRun = process.argv.includes('--dry-run');
  const stats = await backfillImmunizations(oystehr, dryRun);
  console.log(
    `Immunization backfill ${dryRun ? 'dry run ' : ''}complete: ${
      stats.examined
    } administered vaccine orders examined, ` +
      `${stats.created} ${dryRun ? 'would be created' : 'created'}, ${stats.existing} already had an Immunization, ` +
      `${stats.skipped} skipped, ${stats.failed} failed`
  );
  if (stats.failed) throw new Error(`Immunization backfill failed for ${stats.failed} orders`);
}

performEffectWithEnvFile(backfill).catch((error) => {
  console.error(error);
  process.exit(1);
});
