import { BatchInputPostRequest } from '@oystehr/sdk';
import { ActivityDefinition } from 'fhir/r4b';
import { QuickTextQuickPickData } from 'utils';
import { QUICK_TEXT_QUICK_PICK_CATEGORY } from '../ehr/shared/quick-pick-categories';
import { quickPickToActivityDefinition, searchQuickPicks } from '../ehr/shared/quick-pick-helpers';
import { createClinicalOystehrClient, getAuth0Token } from '../shared';
import seed from './data/quick-texts-seed.json';
import { performEffectWithEnvFile } from './helpers';

/**
 * One-shot seed of the self-service quick-text message templates.
 *
 * Quick texts are self-managed via the EHR admin UI (create/edit/remove quick picks), so a fresh
 * environment starts with none. This bootstraps a starter set once: it creates the quick-text
 * ActivityDefinition resources, then never tracks them again — customers manage the list through the
 * admin UI without Terraform reverting the change.
 *
 * It seeds exactly once: if the environment already has any quick text it does nothing. This makes it
 * safe for the Terraform provisioner to re-run and safe to invoke by hand, but it intentionally never
 * re-seeds an already-populated env. To re-seed, delete the existing quick texts first, then run again.
 *
 * Quick texts are built with the same helper the admin-create-quick-pick zambda uses, so seeded and
 * self-created quick texts are indistinguishable to the rest of the app. Message bodies use Handlebars
 * tokens ({{patient-first-name}}, {{ai-interview-url}}, {{paperwork-url}}, {{practice-name}},
 * {{office-phone}}, ...) resolved at send time — see QUICK_TEXT_TOKEN_IDS.
 */
const recreateQuickTexts = async (config: any): Promise<void> => {
  const token = await getAuth0Token(config);
  if (!token) throw new Error('Failed to fetch auth token.');
  const oystehr = createClinicalOystehrClient(token, config);

  // Idempotency guard: any existing quick text means this environment was already seeded.
  // Do nothing so re-runs (and repeated deploys) are no-ops.
  const existing = await searchQuickPicks(oystehr, QUICK_TEXT_QUICK_PICK_CATEGORY);
  if (existing.length > 0) {
    console.log(`Quick texts already seeded — found ${existing.length}. Skipping.`);
    return;
  }

  const quickTexts = seed.quickTexts as Omit<QuickTextQuickPickData, 'id'>[];
  console.log(`Seeding ${quickTexts.length} quick texts...`);

  const requests: BatchInputPostRequest<ActivityDefinition>[] = quickTexts.map((quickText) => ({
    method: 'POST',
    url: '/ActivityDefinition',
    resource: quickPickToActivityDefinition(quickText, QUICK_TEXT_QUICK_PICK_CATEGORY),
  }));

  await oystehr.fhir.transaction<ActivityDefinition>({ requests });

  console.log(`Done. Created ${quickTexts.length} quick texts.`);
};

const main = async (): Promise<void> => {
  await performEffectWithEnvFile(recreateQuickTexts);
};

// Let failures propagate and exit non-zero so the Terraform `local-exec`
// provisioner (and any manual run) fails loudly instead of silently succeeding.
main().catch((error) => {
  console.error('Failed to seed quick texts: ', error);
  process.exit(1);
});
