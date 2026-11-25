import { Secrets } from 'utils/lib/secrets';
import { getAuth0Token } from '../shared/getAuth0Token';
import { createClinicalOystehrClient } from '../shared/helpers';
import { deleteImmunizationQuickPicks } from './delete-immunization-quick-picks.helpers';
import { performEffectWithEnvFile } from './helpers';

// npm run delete-immunization-quick-picks -- <env> [--dry-run]
async function run(config: Secrets & { env: string }): Promise<void> {
  const dryRun = process.argv.includes('--dry-run');
  const token = await getAuth0Token(config);
  if (!token) throw new Error('Failed to fetch auth token.');
  const oystehr = createClinicalOystehrClient(token, config);

  const { found, kept, deleted, failed } = await deleteImmunizationQuickPicks(oystehr, dryRun);
  const toDelete = found - kept;
  console.log(
    dryRun
      ? `[${config.env}] dry run: ${toDelete} of ${found} immunization quick picks are not on a CVX vaccine and would be deleted`
      : `[${config.env}] deleted ${deleted} of ${toDelete} immunization quick picks not on a CVX vaccine; kept ${kept}`
  );
  if (failed) throw new Error(`${failed} immunization quick picks could not be deleted`);
}

performEffectWithEnvFile(run).catch((error) => {
  console.error(error);
  process.exit(1);
});
