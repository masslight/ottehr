import { input } from '@inquirer/prompts';
import Oystehr from '@oystehr/sdk';
import { Questionnaire } from 'fhir/r4b';
import { Secrets } from 'utils/lib/secrets';
import { createBillingClient } from '../billing/shared';
import { INVOICING_CONFIG_QUESTIONNAIRE_URL, withInvoiceIssuerSourceItem } from '../rcm/invoice-config/helpers';
import { getAuth0Token } from '../shared/getAuth0Token';
import { createClinicalOystehrClient, RCM_TAG_SYSTEM } from '../shared/helpers';
import { performEffectWithEnvFile } from './helpers';

/**
 * Adds the invoice issuer item to invoicing config Questionnaires created before it existed, in both
 * the EHR and billing workspaces. Saved answers are untouched; a config without an issuer answer reads
 * as the default until it is next saved.
 *
 * Preview by default. Pass `--apply` to update:
 *   npm run add-invoice-issuer-to-invoice-config -- <env>            # preview only
 *   npm run add-invoice-issuer-to-invoice-config -- <env> --apply    # update
 */
const APPLY = process.argv.includes('--apply');

interface PendingUpdate {
  oystehr: Oystehr;
  workspace: string;
  questionnaire: Questionnaire;
}

async function findPendingUpdates(oystehr: Oystehr, workspace: string): Promise<PendingUpdate[]> {
  const questionnaires = (
    await oystehr.fhir.search<Questionnaire>({
      resourceType: 'Questionnaire',
      params: [
        {
          name: '_tag',
          value: `${RCM_TAG_SYSTEM}|invoice-config`,
        },
        {
          name: 'url',
          value: INVOICING_CONFIG_QUESTIONNAIRE_URL,
        },
      ],
    })
  ).unbundle();
  if (questionnaires.length === 0) console.log(`${workspace}: no invoicing config Questionnaire`);

  return questionnaires.flatMap((current) => {
    const questionnaire = withInvoiceIssuerSourceItem(current);
    console.log(`${workspace}: Questionnaire/${current.id} ${questionnaire ? 'needs' : 'already has'} the item`);
    return questionnaire
      ? [
          {
            oystehr,
            workspace,
            questionnaire,
          },
        ]
      : [];
  });
}

async function migrate(config: Secrets & { env: string }): Promise<void> {
  const token = await getAuth0Token(config);
  if (!token) throw new Error('Failed to fetch auth token.');

  console.log(`\n=== add-invoice-issuer-to-invoice-config (${APPLY ? 'APPLY' : 'PREVIEW'}) for ${config.env} ===`);
  console.log(`Project ${config.PROJECT_ID}, ${config.EHR_ORGANIZATION_NAME_SHORT}\n`);

  const pending = [
    ...(await findPendingUpdates(createClinicalOystehrClient(token, config), 'EHR')),
    ...(await findPendingUpdates(createBillingClient(token, config), 'Billing')),
  ];
  if (pending.length === 0) {
    console.log('\nNothing to update.');
    return;
  }

  if (!APPLY) {
    console.log('\nPreview only. Re-run with `--apply` to update.');
    return;
  }

  const answer = await input({
    message: `Add the invoice issuer item to ${pending.length} Questionnaire(s) in ${config.env}? Type "yes":`,
  });
  if (answer.trim().toLowerCase() !== 'yes') {
    console.log('Aborted, nothing changed.');
    return;
  }

  for (const { oystehr, workspace, questionnaire } of pending) {
    await oystehr.fhir.update<Questionnaire>(questionnaire, {
      optimisticLockingVersionId: questionnaire.meta?.versionId,
    });
    console.log(`${workspace}: updated Questionnaire/${questionnaire.id}`);
  }
  console.log('Done.');
}

performEffectWithEnvFile(migrate).catch((error) => {
  console.error(error);
  process.exit(1);
});
