import { BatchInputPostRequest } from '@oystehr/sdk';
import { ActivityDefinition } from 'fhir/r4b';
import { IN_HOUSE_TAG_DEFINITION } from 'utils';
import { createClinicalOystehrClient, fhirApiUrlFromAuth0Audience, getAuth0Token } from '../shared';
import { testItems } from './data/base-in-house-lab-seed-data';
import { performEffectWithEnvFile } from './helpers';
import { buildInHouseLabActivityDefinitions } from './labs/load-in-house-labs-tests';

/**
 * One-shot seed of the self-service in-house lab test catalog.
 *
 * In-house lab tests used to be Terraform-managed (config/oystehr/in-house-lab-activity-definitions.json)
 * but were moved to self-service admin management, which removed the ability to create them on a fresh
 * environment. This bootstraps them once: it creates the starter panel of ActivityDefinition resources,
 * then never tracks them again — customers add/edit/retire tests via the admin UI without Terraform
 * reverting the change.
 *
 * It seeds exactly once: if the environment already has any active in-house lab test it does nothing.
 * This makes it safe for the Terraform provisioner to re-run and safe to invoke by hand, but it
 * intentionally never re-seeds an already-populated env. (This differs from `make-in-house-test-items`,
 * which retires-and-recreates the whole catalog — unsafe once customers have self-managed it.) To
 * re-seed, retire/delete the existing tests first, then run this again.
 *
 * ActivityDefinitions are built with the same shared builder the loader uses, so seeded and
 * self-created tests are indistinguishable to the rest of the app.
 */
const recreateInHouseLabs = async (config: any): Promise<void> => {
  const token = await getAuth0Token(config);
  if (!token) throw new Error('Failed to fetch auth token.');
  const oystehr = createClinicalOystehrClient(
    token,
    {},
    {
      services: {
        fhirApiUrl: fhirApiUrlFromAuth0Audience(config.AUTH0_AUDIENCE),
      },
    }
  );

  // Idempotency guard: any existing active in-house lab test means this environment was already
  // seeded. Do nothing so re-runs (and repeated deploys) are no-ops.
  const existing = (
    await oystehr.fhir.search<ActivityDefinition>({
      resourceType: 'ActivityDefinition',
      params: [
        { name: '_tag', value: IN_HOUSE_TAG_DEFINITION.code },
        { name: 'status', value: 'active' },
      ],
    })
  ).unbundle();
  if (existing.length > 0) {
    console.log(`In-house labs already seeded — found ${existing.length} active tests. Skipping.`);
    return;
  }

  const activityDefinitions = buildInHouseLabActivityDefinitions(testItems);
  console.log(`Seeding ${activityDefinitions.length} in-house lab tests...`);

  const requests: BatchInputPostRequest<ActivityDefinition>[] = activityDefinitions.map((resource) => ({
    method: 'POST',
    url: '/ActivityDefinition',
    resource,
  }));

  await oystehr.fhir.transaction<ActivityDefinition>({ requests });

  console.log(`Done. Created ${activityDefinitions.length} in-house lab tests.`);
};

const main = async (): Promise<void> => {
  await performEffectWithEnvFile(recreateInHouseLabs);
};

// Let failures propagate and exit non-zero so the Terraform `local-exec`
// provisioner (and any manual run) fails loudly instead of silently succeeding.
main().catch((error) => {
  console.error('Failed to seed in-house labs: ', error);
  process.exit(1);
});
