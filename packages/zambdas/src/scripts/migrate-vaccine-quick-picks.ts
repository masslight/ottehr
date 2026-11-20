import { Secrets } from 'utils/lib/secrets';
import { createOystehrClientFromConfig, performEffectWithEnvFile } from './helpers';
import { migrateVaccineQuickPicks } from './migrate-vaccine-quick-picks.helpers';

// One-time upgrade for the vaccine list (CVX_VACCINES) that replaced config/oystehr/vaccines.json: repoints
// the immunization quick picks saved against a retired config vaccine at the matching vaccine in the list.
// Until a quick pick is repointed, applying it leaves the vaccine for the user to pick. The retired
// Medications and existing orders are left as they are. Safe to re-run: a repointed quick pick is skipped.
//   npm run migrate-vaccine-quick-picks -- <env> [--dry-run]
async function migrate(config: Secrets): Promise<void> {
  const oystehr = await createOystehrClientFromConfig(config);
  const dryRun = process.argv.includes('--dry-run');
  const stats = await migrateVaccineQuickPicks(oystehr, dryRun);
  const would = dryRun ? 'would be ' : '';
  console.log(
    `Vaccine quick pick migration ${dryRun ? 'dry run ' : ''}complete: ${stats.quickPicks} quick picks found, ` +
      `${stats.repointed} ${would}repointed, ${stats.alreadyCurrent} already on a list vaccine or without one, ` +
      `${stats.unknown} not in the mapping and left alone, ${stats.failed} failed`
  );
  if (stats.failed) throw new Error(`Vaccine quick pick migration failed for ${stats.failed} quick picks`);
}

performEffectWithEnvFile(migrate).catch((error) => {
  console.error(error);
  process.exit(1);
});
