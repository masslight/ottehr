import Oystehr from '@oystehr/sdk';
import { Identifier, Patient } from 'fhir/r4b';
import { getAllFhirSearchPages } from 'utils/lib/fhir/getAllFhirSearchPages';
import { patchWithOptimisticLock } from 'utils/lib/fhir/helpers';
import {
  clinicalFriendlyIdIdentifier,
  clinicalPatientIdentifier,
  identifierSearchToken,
  resolveClinicalPatientIds,
  SOURCE_IDENTIFIER_SYSTEM,
} from '../billing/shared';

const BACKFILL_PAGE_SIZE = 200;
const BACKFILL_PATCH_CONCURRENCY = 5;

export interface BillingPatientClinicalIdentifierBackfillStats {
  examined: number;
  changed: number;
  patientsGainingIdentifiers: number;
  patientsDroppingStaleIdentifiers: number;
  alreadyIndexed: number;
  skipped: number;
  failed: number;
}

function hasIdentifier(patient: Patient, identifier: Identifier): boolean {
  return !!patient.identifier?.some((i) => i.system === identifier.system && i.value === identifier.value);
}

function missingClinicalPatientIdentifiers({
  patient,
  clinicalId,
  clinicalFriendlyId,
}: {
  patient: Patient;
  clinicalId: string;
  clinicalFriendlyId?: string;
}): Identifier[] {
  const wanted = [
    clinicalPatientIdentifier(clinicalId),
    ...(clinicalFriendlyId ? [clinicalFriendlyIdIdentifier(clinicalFriendlyId)] : []),
  ];
  return wanted.filter((identifier) => !hasIdentifier(patient, identifier));
}

function isStaleClinicalPatientIdentifier(identifier: Identifier, clinicalId: string): boolean {
  return identifier.system === SOURCE_IDENTIFIER_SYSTEM && identifier.value !== clinicalId;
}

function staleClinicalPatientIdentifiers({
  patient,
  clinicalId,
}: {
  patient: Patient;
  clinicalId: string;
}): Identifier[] {
  return (patient.identifier ?? []).filter((identifier) => isStaleClinicalPatientIdentifier(identifier, clinicalId));
}

export async function syncClinicalPatientIdentifiers({
  oystehr,
  patient,
  clinicalId,
  clinicalFriendlyId,
  pruneStale,
}: {
  oystehr: Oystehr;
  patient: Patient;
  clinicalId: string;
  clinicalFriendlyId?: string;
  pruneStale?: boolean;
}): Promise<void> {
  await patchWithOptimisticLock(
    oystehr,
    {
      ...patient,
      id: patient.id!,
    },
    (current) => {
      const missing = missingClinicalPatientIdentifiers({
        patient: current,
        clinicalId,
        clinicalFriendlyId,
      });
      const stale = pruneStale
        ? staleClinicalPatientIdentifiers({
            patient: current,
            clinicalId,
          })
        : [];
      if (missing.length === 0 && stale.length === 0) return [];
      if (stale.length > 0) {
        const kept = (current.identifier ?? []).filter(
          (identifier) => !isStaleClinicalPatientIdentifier(identifier, clinicalId)
        );
        return [
          {
            op: 'replace' as const,
            path: '/identifier',
            value: [...kept, ...missing],
          },
        ];
      }
      return current.identifier?.length
        ? missing.map((identifier) => ({
            op: 'add' as const,
            path: '/identifier/-',
            value: identifier,
          }))
        : [
            {
              op: 'add' as const,
              path: '/identifier',
              value: missing,
            },
          ];
    }
  );
}

export async function backfillBillingPatientClinicalIdentifiers({
  oystehr,
  dryRun,
  pruneStale,
}: {
  oystehr: Oystehr;
  dryRun: boolean;
  pruneStale: boolean;
}): Promise<BillingPatientClinicalIdentifierBackfillStats> {
  const stats: BillingPatientClinicalIdentifierBackfillStats = {
    examined: 0,
    changed: 0,
    patientsGainingIdentifiers: 0,
    patientsDroppingStaleIdentifiers: 0,
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
          oystehr,
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
        const stale = pruneStale
          ? staleClinicalPatientIdentifiers({
              patient,
              clinicalId,
            })
          : [];
        if (!missing.length && !stale.length) {
          stats.alreadyIndexed++;
          return;
        }

        if (!dryRun) {
          try {
            await syncClinicalPatientIdentifiers({
              oystehr,
              patient,
              clinicalId,
              clinicalFriendlyId,
              pruneStale,
            });
          } catch (error) {
            stats.failed++;
            console.error(`Failed to sync clinical identifiers on billing Patient/${patient.id}`, error);
            return;
          }
        }

        stats.changed++;
        if (missing.length) {
          stats.patientsGainingIdentifiers++;
          console.log(
            `Patient/${patient.id} ${dryRun ? 'would gain' : 'gained'} identifiers: ` +
              `${missing.map((identifier) => identifier.system).join(', ')}`
          );
        }
        if (stale.length) {
          stats.patientsDroppingStaleIdentifiers++;
          console.log(
            `Patient/${patient.id} ${dryRun ? 'would drop' : 'dropped'} stale identifiers: ` +
              `${stale.map(identifierSearchToken).join(', ')}`
          );
        }
      })
    );
  }

  return stats;
}
