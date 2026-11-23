import { Secrets } from 'utils/lib/secrets';
import { createOystehrClientFromConfig, performEffectWithEnvFile } from './helpers';
import { migrateVaccineCatalog } from './migrate-vaccine-catalog.helpers';

// One-time upgrade for the vaccine catalog (Admin › Clinical › In-House Medications): adds a catalog vaccine,
// set up for inventory in doses, for each vaccine the practice already uses. That is each vaccine the retired
// config/oystehr/vaccines.json created, matched to the vaccine list through CONFIG_VACCINE_MAPPINGS
// (config-vaccine-mappings.ts), and each list vaccine an immunization quick pick gives. Without it the catalog
// starts empty and an admin adds every vaccine by hand. No lots are received and nothing else changes. Safe to
// re-run: a vaccine the catalog already has is skipped, and one that was removed from the catalog stays removed.
//   npm run migrate-vaccine-catalog -- <env> [--dry-run]
async function migrate(config: Secrets): Promise<void> {
  const oystehr = await createOystehrClientFromConfig(config);
  const dryRun = process.argv.includes('--dry-run');
  const stats = await migrateVaccineCatalog(oystehr, dryRun);
  const would = dryRun ? 'would be ' : '';
  console.log(
    `Vaccine catalog migration ${dryRun ? 'dry run ' : ''}complete: ${stats.configVaccines} config vaccines and ` +
      `${stats.quickPicks} quick picks found, ${stats.added} catalog vaccines ${would}added, ` +
      `${stats.alreadyActive} already in the catalog, ${stats.removed} removed before and left removed, ` +
      `${stats.unknown} not matched and left alone, ${stats.failed} failed`
  );
  if (stats.failed) throw new Error(`Vaccine catalog migration failed for ${stats.failed} vaccines`);
}

performEffectWithEnvFile(migrate).catch((error) => {
  console.error(error);
  process.exit(1);
});
