import Oystehr from '@oystehr/sdk';
import { Operation } from 'fast-json-patch';
import { Patient } from 'fhir/r4b';
import { clinicalPatientIdentifier, clinicalPatientIdOfCopy, EXCLUDE_WORKING_COPIES_PARAMS } from '../billing/shared';
import { fetchAllPages } from '../shared';

const PAGE_SIZE = 500;

export interface BillingPatientIdentifierStats {
  examined: number;
  stamped: number;
  noClinicalSource: number;
  alreadyKeyed: number;
  duplicatesLeftUnmatched: number;
  failed: number;
}

export interface IdentifierStampPlan {
  toStamp: Patient[];
  noClinicalSource: number;
  alreadyKeyed: number;
  duplicatesLeftUnmatched: number;
}

async function fetchMainBillingPatients(oystehr: Oystehr): Promise<Patient[]> {
  const patients: Patient[] = [];
  await fetchAllPages(async (offset, count) => {
    const bundle = await oystehr.fhir.search<Patient>({
      resourceType: 'Patient',
      params: [
        {
          name: '_count',
          value: String(count),
        },
        {
          name: '_offset',
          value: String(offset),
        },
        ...EXCLUDE_WORKING_COPIES_PARAMS,
      ],
    });
    patients.push(...bundle.unbundle());
    return bundle;
  }, PAGE_SIZE);
  return patients;
}

function hasClinicalPatientIdentifier(patient: Patient, clinicalPatientId: string): boolean {
  const identifier = clinicalPatientIdentifier(clinicalPatientId);
  return !!patient.identifier?.some((i) => i.system === identifier.system && i.value === identifier.value);
}

export function planIdentifierStamps(patients: Patient[]): IdentifierStampPlan {
  const plan: IdentifierStampPlan = {
    toStamp: [],
    noClinicalSource: 0,
    alreadyKeyed: 0,
    duplicatesLeftUnmatched: 0,
  };

  const groups = new Map<string, Patient[]>();
  for (const patient of patients) {
    const clinicalPatientId = patient.id ? clinicalPatientIdOfCopy(patient) : undefined;
    if (!clinicalPatientId) {
      plan.noClinicalSource++;
      continue;
    }
    const group = groups.get(clinicalPatientId) ?? [];
    group.push(patient);
    groups.set(clinicalPatientId, group);
  }

  for (const [clinicalPatientId, members] of groups) {
    const ordered = [...members].sort((a, b) => (b.meta?.lastUpdated ?? '').localeCompare(a.meta?.lastUpdated ?? ''));
    plan.duplicatesLeftUnmatched += ordered.length - 1;
    if (ordered.some((patient) => hasClinicalPatientIdentifier(patient, clinicalPatientId))) {
      plan.alreadyKeyed++;
      continue;
    }
    plan.toStamp.push(ordered[0]);
  }
  return plan;
}

export function identifierPatchOperations(patient: Patient, clinicalPatientId: string): Operation[] {
  const identifier = clinicalPatientIdentifier(clinicalPatientId);
  return patient.identifier?.length
    ? [
        {
          op: 'add',
          path: '/identifier/-',
          value: identifier,
        },
      ]
    : [
        {
          op: 'add',
          path: '/identifier',
          value: [identifier],
        },
      ];
}

export async function backfillBillingPatientIdentifiers(
  oystehr: Oystehr,
  dryRun: boolean
): Promise<BillingPatientIdentifierStats> {
  const patients = await fetchMainBillingPatients(oystehr);
  const plan = planIdentifierStamps(patients);
  const stats: BillingPatientIdentifierStats = {
    examined: patients.length,
    stamped: 0,
    noClinicalSource: plan.noClinicalSource,
    alreadyKeyed: plan.alreadyKeyed,
    duplicatesLeftUnmatched: plan.duplicatesLeftUnmatched,
    failed: 0,
  };

  for (const patient of plan.toStamp) {
    const clinicalPatientId = clinicalPatientIdOfCopy(patient)!;
    console.log(
      `${dryRun ? '[dry run] ' : ''}Patient/${patient.id} -> identifier for clinical Patient/${clinicalPatientId}`
    );
    if (dryRun) {
      stats.stamped++;
      continue;
    }
    try {
      await oystehr.fhir.patch({
        resourceType: 'Patient',
        id: patient.id!,
        operations: identifierPatchOperations(patient, clinicalPatientId),
      });
      stats.stamped++;
    } catch (error) {
      stats.failed++;
      console.error(`Failed to stamp Patient/${patient.id}, re-run to retry:`, error);
    }
  }
  return stats;
}
