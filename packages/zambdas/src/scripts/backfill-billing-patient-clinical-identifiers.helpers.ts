import Oystehr from '@oystehr/sdk';
import { Patient } from 'fhir/r4b';
import { getAllFhirSearchPages } from 'utils';
import {
  addClinicalPatientIdentifiers,
  clinicalPatientIdOfCopy,
  EXCLUDE_WORKING_COPIES_PARAMS,
  missingClinicalPatientIdentifiers,
} from '../billing/shared';

const BACKFILL_PAGE_SIZE = 200;
const BACKFILL_PATCH_CONCURRENCY = 5;

export interface BillingPatientClinicalIdentifierBackfillStats {
  examined: number;
  patched: number;
  alreadyIndexed: number;
  skipped: number;
  failed: number;
}

export async function backfillBillingPatientClinicalIdentifiers(
  oystehr: Oystehr,
  dryRun: boolean
): Promise<BillingPatientClinicalIdentifierBackfillStats> {
  const stats: BillingPatientClinicalIdentifierBackfillStats = {
    examined: 0,
    patched: 0,
    alreadyIndexed: 0,
    skipped: 0,
    failed: 0,
  };

  const patients = await getAllFhirSearchPages<Patient>(
    {
      resourceType: 'Patient',
      params: [...EXCLUDE_WORKING_COPIES_PARAMS],
    },
    oystehr,
    BACKFILL_PAGE_SIZE
  );
  stats.examined = patients.length;
  console.log(`Examining ${patients.length} billing Patients`);

  for (let index = 0; index < patients.length; index += BACKFILL_PATCH_CONCURRENCY) {
    const batch = patients.slice(index, index + BACKFILL_PATCH_CONCURRENCY);
    await Promise.all(
      batch.map(async (patient) => {
        const clinicalPatientId = clinicalPatientIdOfCopy(patient);
        if (!patient.id || !clinicalPatientId) {
          stats.skipped++;
          return;
        }

        const missing = missingClinicalPatientIdentifiers(patient, clinicalPatientId);
        if (!missing.length) {
          stats.alreadyIndexed++;
          return;
        }

        const missingSystems = missing.map((identifier) => identifier.system).join(', ');
        if (dryRun) {
          console.log(`Patient/${patient.id} would gain identifiers: ${missingSystems}`);
          stats.patched++;
          return;
        }

        try {
          await addClinicalPatientIdentifiers({
            oystehr,
            patient,
            clinicalPatientId,
          });
          stats.patched++;
          console.log(`Patient/${patient.id} gained identifiers: ${missingSystems}`);
        } catch (error) {
          stats.failed++;
          console.error(`Failed to add clinical identifiers to billing Patient/${patient.id}`, error);
        }
      })
    );
  }

  return stats;
}
