import { ValueSet } from 'fhir/r4b';
import { CPT_CODE_SYSTEM, EM_CODES_VALUE_SET_URL, EmCodeOption } from 'utils';
import { createClinicalOystehrClient, getAuth0Token } from '../shared';
import seed from './data/em-codes-seed.json';
import { performEffectWithEnvFile } from './helpers';

/**
 * One-shot seed of the self-service E&M codes ValueSet.
 *
 * E&M codes used to be Terraform-managed (config/oystehr/em-codes.json -> the em-codes ValueSet) but
 * were moved to self-service admin management (em-codes create/update/delete zambdas patch the
 * ValueSet's expansion.contains). The CRUD requires the ValueSet to already exist, so a fresh
 * environment — with the resource removed from Terraform — has nothing to edit. This bootstraps it
 * once: it creates the em-codes ValueSet with a starter set of codes, then never tracks it again, so
 * customers add/edit/remove codes via the admin UI without Terraform reverting the change.
 *
 * It seeds exactly once: if the em-codes ValueSet already exists it does nothing. This makes it safe
 * for the Terraform provisioner to re-run and safe to invoke by hand, but it intentionally never
 * re-seeds an already-populated env. To re-seed, delete the existing ValueSet first, then run again.
 *
 * The ValueSet is built to match what the CRUD reads/writes (expansion.contains of CPT codings), so
 * seeded and self-created codes are indistinguishable to the rest of the app.
 */
const recreateEmCodes = async (config: any): Promise<void> => {
  const token = await getAuth0Token(config);
  if (!token) throw new Error('Failed to fetch auth token.');
  const oystehr = createClinicalOystehrClient(token, config);

  // Idempotency guard: an existing em-codes ValueSet means this environment was already seeded.
  // Do nothing so re-runs (and repeated deploys) are no-ops.
  const existing = (
    await oystehr.fhir.search<ValueSet>({
      resourceType: 'ValueSet',
      params: [{ name: 'url', value: EM_CODES_VALUE_SET_URL }],
    })
  )
    .unbundle()
    .find((vs) => vs.url === EM_CODES_VALUE_SET_URL);
  if (existing) {
    console.log(`E&M codes ValueSet already exists (${existing.id}) — skipping.`);
    return;
  }

  const codes = seed.codes as EmCodeOption[];
  console.log(`Seeding E&M codes ValueSet with ${codes.length} codes...`);

  const valueSet: ValueSet = {
    resourceType: 'ValueSet',
    url: EM_CODES_VALUE_SET_URL,
    name: 'EMCodes',
    title: 'E&M Codes',
    status: 'active',
    expansion: {
      timestamp: new Date().toISOString(),
      contains: codes.map((entry) => ({ system: CPT_CODE_SYSTEM, code: entry.code, display: entry.display })),
    },
  };

  await oystehr.fhir.create<ValueSet>(valueSet);

  console.log(`Done. Created E&M codes ValueSet with ${codes.length} codes.`);
};

const main = async (): Promise<void> => {
  await performEffectWithEnvFile(recreateEmCodes);
};

// Let failures propagate and exit non-zero so the Terraform `local-exec`
// provisioner (and any manual run) fails loudly instead of silently succeeding.
main().catch((error) => {
  console.error('Failed to seed E&M codes: ', error);
  process.exit(1);
});
