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

const SOURCE_IDENTIFIER_SYSTEMS: string[] = [SOURCE_IDENTIFIER_SYSTEM, SOURCE_FRIENDLY_PATIENT_ID_SYSTEM];

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

// Each system is adjudicated on its own: a copy whose main Patient is gone still resolves the
// friendly id off its own extension, and indexing that is better than indexing nothing.
function wantedIdentifiersBySystem({
  clinicalId,
  clinicalFriendlyId,
}: {
  clinicalId?: string;
  clinicalFriendlyId?: string;
}): Map<string, string> {
  const wanted = new Map<string, string>();
  if (clinicalId) wanted.set(SOURCE_IDENTIFIER_SYSTEM, clinicalId);
  if (clinicalFriendlyId) wanted.set(SOURCE_FRIENDLY_PATIENT_ID_SYSTEM, clinicalFriendlyId);
  return wanted;
}

function missingClinicalPatientIdentifiers({
  patient,
  clinicalId,
  clinicalFriendlyId,
}: {
  patient: Patient;
  clinicalId?: string;
  clinicalFriendlyId?: string;
}): Identifier[] {
  const wanted = [
    ...(clinicalId ? [clinicalPatientIdentifier(clinicalId)] : []),
    ...(clinicalFriendlyId ? [clinicalFriendlyIdIdentifier(clinicalFriendlyId)] : []),
  ];
  return wanted.filter((identifier) => !hasIdentifier(patient, identifier));
}

function staleClinicalPatientIdentifiers({
  patient,
  clinicalId,
  clinicalFriendlyId,
  isBillingPatientId,
}: {
  patient: Patient;
  clinicalId?: string;
  clinicalFriendlyId?: string;
  isBillingPatientId: (id: string) => boolean;
}): Identifier[] {
  const wantedBySystem = wantedIdentifiersBySystem({
    clinicalId,
    clinicalFriendlyId,
  });
  return (patient.identifier ?? []).filter((identifier) => {
    const wanted = identifier.system ? wantedBySystem.get(identifier.system) : undefined;
    if (wanted) return identifier.value !== wanted;
    // Nothing resolved for this system, but a source identifier is still provably wrong when its
    // value names a Patient in the billing workspace: the system indexes clinical Patients, which a
    // billing scan can never contain. A value naming no scanned Patient is left alone, since a
    // deleted billing Patient and a clinical Patient look the same from here.
    return identifier.system === SOURCE_IDENTIFIER_SYSTEM && !!identifier.value && isBillingPatientId(identifier.value);
  });
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
  return {
    missing: missingClinicalPatientIdentifiers({
      patient,
      clinicalId,
      clinicalFriendlyId,
    }),
    stale: pruneStale
      ? staleClinicalPatientIdentifiers({
          patient,
          clinicalId,
          clinicalFriendlyId,
          isBillingPatientId,
        })
      : [],
  };
}

// A skipped patient has nothing missing and nothing stale, so the identifiers left to account for
// are the ones in a system this run resolved nothing for. Both source systems index a clinical
// Patient, so both leave a patient searchable by a value this run could not confirm.
function unadjudicatedSourceIdentifiers({
  patient,
  clinicalId,
  clinicalFriendlyId,
}: {
  patient: Patient;
  clinicalId?: string;
  clinicalFriendlyId?: string;
}): Identifier[] {
  const wantedBySystem = wantedIdentifiersBySystem({
    clinicalId,
    clinicalFriendlyId,
  });
  return (patient.identifier ?? []).filter(
    (identifier) =>
      !!identifier.system &&
      SOURCE_IDENTIFIER_SYSTEMS.includes(identifier.system) &&
      !wantedBySystem.has(identifier.system)
  );
}

function identifierTokens(identifiers: Identifier[]): string {
  return identifiers.map(identifierSearchToken).join(', ');
}

// Skipping is only safe if it is visible: a patient carrying source identifiers this run could not
// adjudicate needs either the prune flag or a human, and saying which is what makes a run verifiable.
function recordSkip({
  stats,
  patient,
  clinicalId,
  clinicalFriendlyId,
  pruneStale,
  isBillingPatientId,
}: {
  stats: BillingPatientClinicalIdentifierBackfillStats;
  patient: Patient;
  clinicalId?: string;
  clinicalFriendlyId?: string;
  pruneStale?: boolean;
  isBillingPatientId: (id: string) => boolean;
}): void {
  stats.skipped++;
  if (!patient.id) {
    stats.skippedNeedingReview++;
    console.log('A scanned billing Patient has no id and cannot be indexed');
    return;
  }
  // Claiming the flag would drop these means computing what it would drop, not a rule that resembles
  // it. Without the flag the caller's prune plan was empty by definition, so ask for one here.
  const prunable = pruneStale
    ? []
    : staleClinicalPatientIdentifiers({
        patient,
        clinicalId,
        clinicalFriendlyId,
        isBillingPatientId,
      });
  if (prunable.length) {
    stats.skippedWithPrunableIdentifiers++;
    console.log(
      `Patient/${patient.id} keeps source identifiers that --prune-stale would drop: ${identifierTokens(prunable)}`
    );
    return;
  }
  const unadjudicated = unadjudicatedSourceIdentifiers({
    patient,
    clinicalId,
    clinicalFriendlyId,
  });
  if (!unadjudicated.length) {
    stats.skippedWithNothingToIndex++;
    return;
  }
  stats.skippedNeedingReview++;
  console.log(
    `Patient/${patient.id} has source identifiers that resolve to no clinical Patient: ` +
      `${identifierTokens(unadjudicated)}`
  );
}

export async function syncClinicalPatientIdentifiers({
  oystehr,
  patient,
  clinicalId,
  clinicalFriendlyId,
  pruneStale,
  isBillingPatientId,
}: {
  oystehr: Oystehr;
  patient: Patient;
  clinicalId?: string;
  clinicalFriendlyId?: string;
  pruneStale?: boolean;
  // Required: a prune that cannot tell a billing id from a clinical one silently keeps identifiers
  // it was asked to drop, and defaulting the answer to "no" hides that from the caller
  isBillingPatientId: (id: string) => boolean;
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
        if (!patient.id) {
          recordSkip({
            stats,
            patient,
            pruneStale,
            isBillingPatientId,
          });
          return;
        }

        const { clinicalId, clinicalFriendlyId } = await resolveClinicalPatientIds({
          oystehr,
          patient,
          fetchBillingPatient,
        });
        const { missing, stale } = planClinicalIdentifiers({
          patient,
          clinicalId,
          clinicalFriendlyId,
          pruneStale,
          isBillingPatientId,
        });
        if (!missing.length && !stale.length) {
          if (clinicalId) {
            stats.alreadyIndexed++;
          } else {
            recordSkip({
              stats,
              patient,
              clinicalId,
              clinicalFriendlyId,
              pruneStale,
              isBillingPatientId,
            });
          }
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
            `Patient/${patient.id} ${dryRun ? 'would drop' : 'dropped'} stale identifiers: ${identifierTokens(stale)}`
          );
        }
      })
    );
  }

  return stats;
}
