import { input } from '@inquirer/prompts';
import { Secrets } from 'utils/lib/secrets';
import { createBillingClient } from '../billing/shared';
import { getAuth0Token } from '../shared/getAuth0Token';
import {
  deleteTagBasics,
  describeSystemTagBasicCleanupPlan,
  planSystemTagBasicCleanupFor,
} from './delete-billing-system-tag-basics.helpers';
import { performEffectWithEnvFile } from './helpers';

/**
 * One-off cleanup to remove the stored Basic definitions of system-managed billing tags.
 *
 * Earlier releases seeded a Basic per system-managed tag (Hold, Auto Accident, secondary-submission,
 * waiting-for-non-primary-ERA) from a read-then-create with no uniqueness constraint. The seeding
 * ran on every ClaimResponse subscription, so one ERA batch had many invocations racing each other
 * and each creating the same definitions — leaving several copies of each tag on the Tags page,
 * undeletable through the UI because delete-billing-tag refuses system tags.
 *
 * The seeding is gone and system-managed tags are reported straight from SYSTEM_MANAGED_TAGS, so
 * every stored definition of one is now a leftover. Deleting them is safe: nothing references a tag
 * definition by id — claims carry the tag name in meta.tag, and rules validate by name.
 *
 * User-created tags are never touched. Duplicated user tags and definitions whose name merely
 * resembles a system-managed one are reported for manual review instead.
 *
 * Dry-run by default; pass `--apply` to actually delete:
 *   npm run delete-billing-system-tag-basics -- <env>            # report only
 *   npm run delete-billing-system-tag-basics -- <env> --apply    # delete
 *
 * Run it only after the seeding removal has been deployed to that environment, or the next ERA
 * batch will recreate what this deletes.
 */
const APPLY = process.argv.includes('--apply');

async function cleanup(config: Secrets & { env: string }): Promise<void> {
  const token = await getAuth0Token(config);
  if (!token) throw new Error('Failed to fetch auth token.');
  // The billing workspace is tag-scoped; a clinical client ignores BILLING_RESOURCE_TAG and would
  // find none of these definitions.
  const oystehr = createBillingClient(token, config);

  const plan = await planSystemTagBasicCleanupFor(oystehr);

  console.log(`\n=== delete-billing-system-tag-basics (${APPLY ? 'APPLY' : 'DRY-RUN'}) — ${config.env} ===`);
  console.log(describeSystemTagBasicCleanupPlan(plan));

  if (plan.deletions.length === 0) return;
  if (!APPLY) {
    console.log('\nDry-run only. Re-run with `--apply` to delete.');
    return;
  }

  console.log(`\nAbout to delete ${plan.deletions.length} tag definition(s) in ${config.env}.`);
  const answer = await input({ message: 'Type "yes" to confirm:' });
  if (answer.trim().toLowerCase() !== 'yes') {
    console.log('Aborted; nothing changed.');
    return;
  }

  const deleted = await deleteTagBasics(oystehr, plan.deletions);
  console.log(`Done: deleted ${deleted} of ${plan.deletions.length} definition(s).`);
  if (deleted < plan.deletions.length) {
    throw new Error(`Failed to delete ${plan.deletions.length - deleted} tag definition(s)`);
  }
}

performEffectWithEnvFile(cleanup).catch((error) => {
  console.error(error);
  process.exit(1);
});
