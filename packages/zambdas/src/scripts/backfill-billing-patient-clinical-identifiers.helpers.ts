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
  SOURCE_FRIENDLY_PATIENT_ID_SYSTEM,
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
  // The three reasons partition skipped, so a run can be verified without reading every log line
  skippedWithNothingToIndex: number;
  skippedWithPrunableIdentifiers: number;
  skippedNeedingReview: number;
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

function staleClinicalPatientIdentifiers({
  patient,
  clinicalId,
  clinicalFriendlyId,
}: {
  patient: Patient;
  clinicalId: string;
  clinicalFriendlyId?: string;
}): Identifier[] {
  const wantedBySystem = new Map<string, string>([[SOURCE_IDENTIFIER_SYSTEM, clinicalId]]);
  if (clinicalFriendlyId) wantedBySystem.set(SOURCE_FRIENDLY_PATIENT_ID_SYSTEM, clinicalFriendlyId);
  return (patient.identifier ?? []).filter((identifier) => {
    const wanted = identifier.system ? wantedBySystem.get(identifier.system) : undefined;
    return !!wanted && identifier.value !== wanted;
  });
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
          clinicalFriendlyId,
        })
      : unindexableClinicalPatientIdentifiers({
          patient,
          isBillingPatientId,
        }),
  };
}

function sourceClinicalPatientIdentifiers(patient: Patient): Identifier[] {
  return (patient.identifier ?? []).filter((identifier) => identifier.system === SOURCE_IDENTIFIER_SYSTEM);
}

// Skipping is only safe if it is visible: a patient carrying source identifiers this run could not
// adjudicate needs either the prune flag or a human, and saying which is what makes a run verifiable.
function recordSkip({
  stats,
  patient,
  pruneStale,
  isBillingPatientId,
}: {
  stats: BillingPatientClinicalIdentifierBackfillStats;
  patient: Patient;
  pruneStale?: boolean;
  isBillingPatientId: (id: string) => boolean;
}): void {
  stats.skipped++;
  if (!patient.id) {
    stats.skippedNeedingReview++;
    console.log('A scanned billing Patient has no id and cannot be indexed');
    return;
  }
  const sourceIdentifiers = sourceClinicalPatientIdentifiers(patient);
  if (!sourceIdentifiers.length) {
    stats.skippedWithNothingToIndex++;
    return;
  }
  const tokens = sourceIdentifiers.map(identifierSearchToken).join(', ');
  if (!pruneStale && sourceIdentifiers.some((identifier) => identifier.value && isBillingPatientId(identifier.value))) {
    stats.skippedWithPrunableIdentifiers++;
    console.log(`Patient/${patient.id} keeps source identifiers that --prune-stale would drop: ${tokens}`);
    return;
  }
  stats.skippedNeedingReview++;
  console.log(`Patient/${patient.id} has source identifiers that resolve to no clinical Patient: ${tokens}`);
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
    skippedWithNothingToIndex: 0,
    skippedWithPrunableIdentifiers: 0,
    skippedNeedingReview: 0,
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
          recordSkip({
            stats,
            patient,
            pruneStale,
            isBillingPatientId,
          });
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
          if (clinicalId) stats.alreadyIndexed++;
          else
            recordSkip({
              stats,
              patient,
              pruneStale,
              isBillingPatientId,
            });
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
            `Patient/${patient.id} ${dryRun ? 'would drop' : 'dropped'} ` +
              `${clinicalId ? 'stale' : 'unindexable'} identifiers: ${stale.map(identifierSearchToken).join(', ')}`
          );
        }
      })
    );
  }

  return stats;
}
