import { input } from '@inquirer/prompts';
import Oystehr from '@oystehr/sdk';
import { QuestionnaireResponse } from 'fhir/r4b';
import { parseInvoiceConfigFromQR } from 'utils/lib/helpers/rcm/invoice-config';
import { Secrets } from 'utils/lib/secrets';
import { createBillingClient } from '../billing/shared';
import { getOrCreateInvoicingConfig } from '../rcm/invoice-config/helpers';
import { getAuth0Token } from '../shared/getAuth0Token';
import { createClinicalOystehrClient, RCM_TAG_SYSTEM } from '../shared/helpers';
import { performEffectWithEnvFile } from './helpers';

/**
 * One-off copy of the EHR invoicing config (due days, SMS template and invoice memo) into the billing
 * workspace, so the billing app keeps each practice's templates instead of starting from the defaults.
 * The EHR copy is not changed because EHR invoicing keeps using it until it is removed.
 *
 * If the billing config was already saved from the billing app, the preview says so and applying
 * replaces it with the EHR values.
 *
 * Preview by default. Pass `--apply` to copy:
 *   npm run migrate-invoice-config-to-billing -- <env>            # preview only
 *   npm run migrate-invoice-config-to-billing -- <env> --apply    # copy
 */
const APPLY = process.argv.includes('--apply');

async function findConfigResponse(oystehr: Oystehr): Promise<QuestionnaireResponse | undefined> {
  const bundle = await oystehr.fhir.search<QuestionnaireResponse>({
    resourceType: 'QuestionnaireResponse',
    params: [{ name: '_tag', value: `${RCM_TAG_SYSTEM}|invoice-config` }],
  });
  return bundle.unbundle()[0];
}

function describeConfig(qr: QuestionnaireResponse): string {
  const config = parseInvoiceConfigFromQR(qr);
  return [
    `  Due days: ${config.dueDaysFromGeneration}`,
    `  SMS template: ${JSON.stringify(config.defaultSmsTemplate)}`,
    `  Invoice memo: ${JSON.stringify(config.defaultInvoiceMemo)}`,
  ].join('\n');
}

async function migrate(config: Secrets & { env: string }): Promise<void> {
  const token = await getAuth0Token(config);
  if (!token) throw new Error('Failed to fetch auth token.');

  console.log(`\n=== migrate-invoice-config-to-billing (${APPLY ? 'APPLY' : 'PREVIEW'}) for ${config.env} ===`);
  console.log(`Project ${config.PROJECT_ID}, ${config.EHR_ORGANIZATION_NAME_SHORT}`);

  const ehrConfig = await findConfigResponse(createClinicalOystehrClient(token, config));
  if (!ehrConfig) {
    console.log('\nNo EHR invoicing config found, nothing to copy.');
    return;
  }
  console.log(`\nEHR config (QuestionnaireResponse/${ehrConfig.id})\n${describeConfig(ehrConfig)}`);

  const billingOystehr = createBillingClient(token, config);
  const billingConfig = await findConfigResponse(billingOystehr);
  if (!billingConfig) {
    console.log('\nBilling config does not exist yet. It will be created with the EHR values.');
  } else {
    console.log(`\nBilling config (QuestionnaireResponse/${billingConfig.id})\n${describeConfig(billingConfig)}`);
    // Only a save sets authored, so a billing config without it still holds the defaults.
    if (billingConfig.authored) {
      console.log(`\nIt was saved from the billing app on ${billingConfig.authored}. Applying replaces it.`);
    }
  }

  if (!APPLY) {
    console.log('\nPreview only. Re-run with `--apply` to copy.');
    return;
  }

  const answer = await input({ message: `Copy the EHR config into billing for ${config.env}? Type "yes" to confirm:` });
  if (answer.trim().toLowerCase() !== 'yes') {
    console.log('Aborted, nothing changed.');
    return;
  }

  const { questionnaire, questionnaireResponse } = await getOrCreateInvoicingConfig(billingOystehr);
  const copy = await billingOystehr.fhir.update<QuestionnaireResponse>({
    ...questionnaireResponse,
    questionnaire: `Questionnaire/${questionnaire.id}`,
    status: 'completed',
    authored: new Date().toISOString(),
    item: ehrConfig.item,
  });
  console.log(`Done. Billing QuestionnaireResponse/${copy.id} now has the EHR values.`);
}

performEffectWithEnvFile(migrate).catch((error) => {
  console.error(error);
  process.exit(1);
});
