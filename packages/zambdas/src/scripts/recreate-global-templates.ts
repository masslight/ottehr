import Oystehr, { BatchInputPostRequest, BatchInputPutRequest } from '@oystehr/sdk';
import { randomUUID } from 'crypto';
import { List } from 'fhir/r4b';
import { getAuth0Token } from '../shared';
import seed from './data/global-templates-seed.json';
import { fhirApiUrlFromAuth0Audience, performEffectWithEnvFile } from './helpers';

// The Global Templates Holder List is provisioned by Terraform
// (config/oystehr/global-template-holder-list.json -> GlobalTemplatesHolderList).
// Terraform only manages its `status`/`mode`/`title`/`meta` fields; the `entry`
// list (the actual template membership) is left to the application at runtime.
const GLOBAL_TEMPLATES_TAG_SYSTEM = 'https://fhir.zapehr.com/r4/StructureDefinitions/global-template-list';
const GLOBAL_TEMPLATES_TAG_CODE = 'global-templates';

/**
 * One-shot seed of the global note templates.
 *
 * Global templates used to be Terraform-managed but were moved to self-service,
 * which removed the ability to create them on a fresh environment. This script
 * restores that: it creates the templates once and links them to the
 * Terraform-provisioned holder list, then never tracks them again.
 *
 * It seeds exactly once: if the holder already references any templates it does
 * nothing. This makes it safe for the Terraform provisioner to re-run and safe to
 * invoke by hand, but it intentionally never re-seeds an already-populated env.
 * To re-seed, delete the existing templates first, then run this again.
 */
const recreateGlobalTemplates = async (config: any): Promise<void> => {
  const token = await getAuth0Token(config);
  if (!token) throw new Error('Failed to fetch auth token.');
  const oystehr = new Oystehr({
    fhirApiUrl: fhirApiUrlFromAuth0Audience(config.AUTH0_AUDIENCE),
    accessToken: token,
  });

  const holder = await getGlobalTemplatesHolder(oystehr);
  if (!holder) {
    throw new Error(
      'Global Templates Holder List not found. It is provisioned by Terraform (GlobalTemplatesHolderList) — run `terraform apply` first.'
    );
  }

  // Idempotency guard: a populated holder means this environment was already
  // seeded. Do nothing so re-runs (and repeated deploys) are no-ops.
  if ((holder.entry?.length ?? 0) > 0) {
    console.log(`Global templates already seeded — holder ${holder.id} has ${holder.entry!.length} entries. Skipping.`);
    return;
  }

  const templates = seed.templates as List[];
  console.log(`Seeding ${templates.length} global templates into holder ${holder.id}...`);

  // Create every template and re-link the holder in a single atomic transaction.
  // urn:uuid fullUrls let the holder's entry reference the freshly-created
  // templates; the FHIR server resolves them to the assigned List/<id>.
  const templateRequests: BatchInputPostRequest<List>[] = templates.map((resource) => ({
    method: 'POST',
    url: '/List',
    fullUrl: `urn:uuid:${randomUUID()}`,
    resource,
  }));

  const updatedHolder: List = {
    ...holder,
    entry: templateRequests.map((request) => ({ item: { reference: request.fullUrl! } })),
  };

  const holderRequest: BatchInputPutRequest<List> = {
    method: 'PUT',
    url: `/List/${holder.id}`,
    resource: updatedHolder,
  };

  await oystehr.fhir.transaction<List>({
    requests: [...templateRequests, holderRequest],
  });

  console.log(`Done. Created ${templates.length} templates and linked them to holder ${holder.id}.`);
};

const getGlobalTemplatesHolder = async (oystehr: Oystehr): Promise<List | undefined> => {
  return (
    await oystehr.fhir.search<List>({
      resourceType: 'List',
      params: [{ name: '_tag', value: `${GLOBAL_TEMPLATES_TAG_SYSTEM}|${GLOBAL_TEMPLATES_TAG_CODE}` }],
    })
  ).unbundle()[0];
};

const main = async (): Promise<void> => {
  await performEffectWithEnvFile(recreateGlobalTemplates);
};

// Let failures propagate and exit non-zero so the Terraform `local-exec`
// provisioner (and any manual run) fails loudly instead of silently succeeding.
main().catch((error) => {
  console.error('Failed to seed global templates: ', error);
  process.exit(1);
});
