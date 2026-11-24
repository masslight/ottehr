import { Secrets } from 'utils/lib/secrets';
import { deleteImmunizationQuickPicks } from './delete-immunization-quick-picks.helpers';
import { createOystehrClientFromConfig, performEffectWithEnvFile } from './helpers';

// One-time cleanup for the vaccine list (CVX_VACCINES) that replaced config/oystehr/vaccines.json: deletes every
// immunization quick pick. They were saved against the retired config vaccines, which the list does not have, so
// applying one would leave the vaccine for the user to pick. Practices make their quick picks again from the
// list. The retired Medications and existing orders are left as they are. Safe to re-run: it deletes whatever
// immunization quick picks exist, so run it once, when the release reaches the environment.
//   npm run delete-immunization-quick-picks -- <env> [--dry-run]
async function cleanup(config: Secrets): Promise<void> {
  const oystehr = await createOystehrClientFromConfig(config);
  const dryRun = process.argv.includes('--dry-run');
  const stats = await deleteImmunizationQuickPicks(oystehr, dryRun);
  console.log(
    `Immunization quick pick cleanup ${dryRun ? 'dry run ' : ''}complete: ${stats.quickPicks} quick picks found, ` +
      `${stats.deleted} ${dryRun ? 'would be ' : ''}deleted, ${stats.failed} failed`
  );
  if (stats.failed) throw new Error(`Immunization quick pick cleanup failed for ${stats.failed} quick picks`);
}

performEffectWithEnvFile(cleanup).catch((error) => {
  console.error(error);
  process.exit(1);
});
