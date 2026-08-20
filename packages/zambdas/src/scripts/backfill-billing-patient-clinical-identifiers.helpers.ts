import Oystehr from '@oystehr/sdk';
import { Identifier, Patient } from 'fhir/r4b';
import { getAllFhirSearchPages } from 'utils/lib/fhir/getAllFhirSearchPages';
import { patchWithOptimisticLock } from 'utils/lib/fhir/helpers';
import { addOperation, removeOperation, replaceOperation } from 'utils/lib/helpers/operations';
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

// With no clinical id to compare against, a source identifier is still provably wrong when its value
// names a Patient in the billing workspace: the system indexes clinical Patients, which a billing
// scan can never contain. A value naming no scanned Patient is left alone, since a deleted billing
// Patient and a clinical Patient look the same from here.
function unindexableClinicalPatientIdentifiers({
  patient,
  isBillingPatientId,
}: {
  patient: Patient;
  isBillingPatientId: (id: string) => boolean;
}): Identifier[] {
  return (patient.identifier ?? []).filter(
    (identifier) =>
      identifier.system === SOURCE_IDENTIFIER_SYSTEM && !!identifier.value && isBillingPatientId(identifier.value)
  );
}

function planClinicalIdentifiers({
  patient,
  clinicalId,
  clinicalFriendlyId,
  pruneStale,
  isBillingPatientId,
}: {
  patient: Patient;
  clinicalId?: string;
  clinicalFriendlyId?: string;
  pruneStale?: boolean;
  isBillingPatientId: (id: string) => boolean;
}): {
  missing: Identifier[];
  stale: Identifier[];
} {
  const missing = clinicalId
    ? missingClinicalPatientIdentifiers({
        patient,
        clinicalId,
        clinicalFriendlyId,
      })
    : [];
  if (!pruneStale) {
    return {
      missing,
      stale: [],
    };
  }
  return {
    missing,
    stale: clinicalId
      ? staleClinicalPatientIdentifiers({
          patient,
          clinicalId,
        })
      : unindexableClinicalPatientIdentifiers({
          patient,
          isBillingPatientId,
        }),
  };
}

export async function syncClinicalPatientIdentifiers({
  oystehr,
  patient,
  clinicalId,
  clinicalFriendlyId,
  pruneStale,
  isBillingPatientId = () => false,
}: {
  oystehr: Oystehr;
  patient: Patient;
  clinicalId?: string;
  clinicalFriendlyId?: string;
  pruneStale?: boolean;
  isBillingPatientId?: (id: string) => boolean;
}): Promise<void> {
  await patchWithOptimisticLock(
    oystehr,
    {
      ...patient,
      id: patient.id!,
    },
    (current) => {
      const { missing, stale } = planClinicalIdentifiers({
        patient: current,
        clinicalId,
        clinicalFriendlyId,
        pruneStale,
        isBillingPatientId,
      });
      if (missing.length === 0 && stale.length === 0) return [];
      if (stale.length > 0) {
        const dropped = new Set(stale);
        const kept = (current.identifier ?? []).filter((identifier) => !dropped.has(identifier));
        const remaining = [...kept, ...missing];
        // FHIR has no empty arrays, so the element goes away entirely when the prune empties it
        return remaining.length ? [replaceOperation('/identifier', remaining)] : [removeOperation('/identifier')];
      }
      return current.identifier?.length
        ? missing.map((identifier) => addOperation('/identifier/-', identifier))
        : [addOperation('/identifier', missing)];
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
  const isBillingPatientId = (id: string): boolean => scanned.has(id);

  for (let index = 0; index < patients.length; index += BACKFILL_PATCH_CONCURRENCY) {
    const batch = patients.slice(index, index + BACKFILL_PATCH_CONCURRENCY);
    await Promise.all(
      batch.map(async (patient) => {
        const { clinicalId, clinicalFriendlyId } = await resolveClinicalPatientIds({
          oystehr,
          patient,
          fetchBillingPatient,
        });
        if (!patient.id) {
          stats.skipped++;
          return;
        }

        const { missing, stale } = planClinicalIdentifiers({
          patient,
          clinicalId,
          clinicalFriendlyId,
          pruneStale,
          isBillingPatientId,
        });
        if (!missing.length && !stale.length) {
          // An unresolved patient with nothing prunable is not indexed and cannot be
          if (clinicalId) stats.alreadyIndexed++;
          else stats.skipped++;
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
              isBillingPatientId,
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
