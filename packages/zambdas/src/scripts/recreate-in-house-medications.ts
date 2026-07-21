import { BatchInputPostRequest } from '@oystehr/sdk';
import { Coding, Medication } from 'fhir/r4b';
import {
  CODE_SYSTEM_NDC,
  INVENTORY_MEDICATION_TYPE_CODE,
  MEDICATION_DISPENSABLE_DRUG_ID,
  MEDICATION_IDENTIFIER_NAME_SYSTEM,
  MEDICATION_TYPE_SYSTEM,
} from 'utils';
import { createClinicalOystehrClient, fhirApiUrlFromAuth0Audience, getAuth0Token } from '../shared';
import seed from './data/in-house-medications-seed.json';
import { getInHouseInventoryMedications, performEffectWithEnvFile } from './helpers';

interface InHouseMedicationSeed {
  name: string;
  medispanID: string;
  ndc?: string;
}

/**
 * One-shot seed of the self-service in-house medication inventory.
 *
 * In-house medications used to be Terraform-managed (config/oystehr/in-house-medications.json)
 * but were moved to self-service admin management, which removed the ability to create them on a
 * fresh environment. This script restores that: it creates the inventory `Medication` resources
 * once, then never tracks them again — customers add/edit/deactivate meds via the admin UI without
 * Terraform reverting the change.
 *
 * It seeds exactly once: if the environment already has any in-house inventory medications it does
 * nothing. This makes it safe for the Terraform provisioner to re-run and safe to invoke by hand,
 * but it intentionally never re-seeds an already-populated env. To re-seed, delete the existing
 * inventory medications first, then run this again.
 *
 * Each Medication is built exactly like the create-in-house-medication zambda so seeded and
 * self-created meds are indistinguishable to the rest of the app.
 */
const recreateInHouseMedications = async (config: any): Promise<void> => {
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

  // Idempotency guard: any existing inventory med means this environment was already seeded.
  // Do nothing so re-runs (and repeated deploys) are no-ops.
  const existing = await getInHouseInventoryMedications(oystehr);
  if (existing.length > 0) {
    console.log(`In-house medications already seeded — found ${existing.length} inventory meds. Skipping.`);
    return;
  }

  const medications = seed.medications as InHouseMedicationSeed[];
  console.log(`Seeding ${medications.length} in-house medications...`);

  const requests: BatchInputPostRequest<Medication>[] = medications.map((med) => ({
    method: 'POST',
    url: '/Medication',
    resource: buildInventoryMedication(med),
  }));

  await oystehr.fhir.transaction<Medication>({ requests });

  console.log(`Done. Created ${medications.length} in-house inventory medications.`);
};

const buildInventoryMedication = (med: InHouseMedicationSeed): Medication => {
  const coding: Coding[] = [];
  if (med.ndc) {
    coding.push({ system: CODE_SYSTEM_NDC, code: med.ndc });
  }
  coding.push({ system: MEDICATION_DISPENSABLE_DRUG_ID, code: med.medispanID });

  return {
    resourceType: 'Medication',
    identifier: [
      { system: MEDICATION_TYPE_SYSTEM, value: INVENTORY_MEDICATION_TYPE_CODE },
      { system: MEDICATION_IDENTIFIER_NAME_SYSTEM, value: med.name },
    ],
    status: 'active',
    code: { coding },
  };
};

const main = async (): Promise<void> => {
  await performEffectWithEnvFile(recreateInHouseMedications);
};

// Let failures propagate and exit non-zero so the Terraform `local-exec`
// provisioner (and any manual run) fails loudly instead of silently succeeding.
main().catch((error) => {
  console.error('Failed to seed in-house medications: ', error);
  process.exit(1);
});
