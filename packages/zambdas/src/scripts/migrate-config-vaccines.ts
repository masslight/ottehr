import { Secrets } from 'utils/lib/secrets';
import { createOystehrClientFromConfig, performEffectWithEnvFile } from './helpers';
import { migrateConfigVaccines } from './migrate-config-vaccines.helpers';

// One-time upgrade: switches on the catalog vaccine for each vaccine the retired config/oystehr/vaccines.json
// created, so the order screen's list is not empty until an admin visits In-House Medications, and repoints the
// immunization quick picks saved against those old vaccines at the catalog ones. The old Medications are left as
// they are; old orders keep pointing at them. Safe to re-run: an entry already on or a quick pick already
// repointed is skipped.
//   npm run migrate-config-vaccines -- <env> [--dry-run]
async function migrate(config: Secrets): Promise<void> {
  const oystehr = await createOystehrClientFromConfig(config);
  const dryRun = process.argv.includes('--dry-run');
  const stats = await migrateConfigVaccines(oystehr, dryRun);
  const would = dryRun ? 'would be ' : '';
  console.log(
    `Config vaccine migration ${dryRun ? 'dry run ' : ''}complete: ${stats.configVaccines} config vaccines found, ` +
      `${stats.switchedOn} catalog vaccines ${would}switched on, ${stats.alreadyOn} already on, ` +
      `${stats.unknown} not in the mapping; ${stats.quickPicksRepointed} quick picks ${would}repointed, ` +
      `${stats.quickPicksAlreadyCatalog} already on a catalog vaccine, ${stats.quickPicksUnknown} left alone; ` +
      `${stats.failed} failed`
  );
  if (stats.failed) throw new Error(`Config vaccine migration failed for ${stats.failed} vaccines or quick picks`);
}

performEffectWithEnvFile(migrate).catch((error) => {
  console.error(error);
  process.exit(1);
});
