import Oystehr from '@oystehr/sdk';
import { Patient } from 'fhir/r4b';
import { getAllFhirSearchPages } from 'utils/lib/fhir/getAllFhirSearchPages';
import {
  addClinicalPatientIdentifiers,
  missingClinicalPatientIdentifiers,
  resolveClinicalPatientIds,
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
      params: [],
    },
    oystehr,
    BACKFILL_PAGE_SIZE
  );
  stats.examined = patients.length;
  console.log(`Examining ${patients.length} billing Patients`);

  const scanned = new Map(patients.filter((patient) => patient.id).map((patient) => [patient.id!, patient]));
  const fetchBillingPatient = async (id: string): Promise<Patient | undefined> => scanned.get(id);

  for (let index = 0; index < patients.length; index += BACKFILL_PATCH_CONCURRENCY) {
    const batch = patients.slice(index, index + BACKFILL_PATCH_CONCURRENCY);
    await Promise.all(
      batch.map(async (patient) => {
        const { clinicalId, clinicalFriendlyId } = await resolveClinicalPatientIds({
          patient,
          fetchBillingPatient,
        });
        if (!patient.id || !clinicalId) {
          stats.skipped++;
          return;
        }

        const missing = missingClinicalPatientIdentifiers({
          patient,
          clinicalId,
          clinicalFriendlyId,
        });
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
            clinicalId,
            clinicalFriendlyId,
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
