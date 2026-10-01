// Account / coverage picture of many patients at once for the ad-hoc datasets. It is the patient-account
// page's own (getAccountAndCoverageResourcesForPatient): the same search — run once for all patients, as an
// async-bulk job — the same payer lookup, and the same assembly per patient. Only the per-patient split of
// the bulk result is done here: each patient gets exactly what its own search would have returned.
import Oystehr from '@oystehr/sdk';
import { Account, Coverage, FhirResource, Organization, Patient, RelatedPerson } from 'fhir/r4b';
import { getPatientReferenceFromAccount } from 'utils/lib/fhir/helpers';
import { PatientAccountAndCoverageResources } from 'utils/lib/types/data/account';
import {
  assemblePatientAccountAndCoverageResources,
  getCoveragePayorReferences,
  PATIENT_ACCOUNT_AND_COVERAGE_SEARCH_INCLUDES,
  searchInsuranceInformation,
} from '../../ehr/shared/harvest';
import { fetchScopedResources } from '../adhoc-report';

type AccountSearchResource = Patient | Account | Coverage | RelatedPerson | Organization;

const referenceOf = (resource: FhirResource): string => `${resource.resourceType}/${resource.id}`;

const groupBy = <T>(items: T[], key: (item: T) => string | undefined): Map<string, T[]> => {
  const out = new Map<string, T[]>();

  for (const item of items) {
    const k = key(item);

    if (k) out.set(k, [...(out.get(k) ?? []), item]);
  }

  return out;
};

/** The bulk result indexed once, so each patient's share is picked out by lookups, not scans. */
const indexAccountResources = (all: AccountSearchResource[]): ((patientRef: string) => AccountSearchResource[]) => {
  const accountsByPatient = groupBy(
    all.filter((r): r is Account => r.resourceType === 'Account'),
    (a) => getPatientReferenceFromAccount(a)
  );
  const coveragesByPatient = groupBy(
    all.filter((r): r is Coverage => r.resourceType === 'Coverage'),
    (c) => c.beneficiary?.reference
  );
  const relatedPersonsByPatient = groupBy(
    all.filter((r): r is RelatedPerson => r.resourceType === 'RelatedPerson'),
    (rp) => rp.patient?.reference
  );
  const byRef = new Map<string, AccountSearchResource>(
    all
      .filter((r) => r.resourceType === 'Organization' || r.resourceType === 'RelatedPerson')
      .map((r) => [referenceOf(r), r])
  );

  // The resources one patient's own patient-account search returns. Organizations come in only as an
  // Account owner or a Coverage payor; subscribers as a Coverage subscriber.
  return (patientRef) => {
    const accounts = accountsByPatient.get(patientRef) ?? [];
    const coverages = coveragesByPatient.get(patientRef) ?? [];

    const linkedRefs = new Set(
      [
        ...accounts.map((a) => a.owner?.reference),
        ...coverages.flatMap((c) => [...c.payor.map((p) => p.reference), c.subscriber?.reference]),
      ].filter((ref): ref is string => !!ref)
    );
    const linked: AccountSearchResource[] = [];

    for (const ref of linkedRefs) {
      const resource = byRef.get(ref);

      if (resource) linked.push(resource);
    }
    return [...accounts, ...coverages, ...(relatedPersonsByPatient.get(patientRef) ?? []), ...linked];
  };
};

// Payer lookups go to the RCM service one by one; a bounded number at a time keeps a report with hundreds of
// payers from being throttled.
const PAYER_LOOKUP_CONCURRENCY = 8;

/**
 * Account, guarantor, coverages (with resolved payers), employer organizations and emergency contact of each
 * patient, keyed by `Patient/{id}`. Patients without any account data still get an entry (coverages empty).
 */
export async function fetchPatientAccounts(
  oystehr: Oystehr,
  patients: Patient[]
): Promise<Map<string, PatientAccountAndCoverageResources>> {
  const out = new Map<string, PatientAccountAndCoverageResources>();
  const ids = patients.map((p) => p.id).filter((id): id is string => !!id);
  if (!ids.length) return out;

  const all = (
    await fetchScopedResources<AccountSearchResource>(
      oystehr,
      'Patient',
      '_id',
      ids,
      PATIENT_ACCOUNT_AND_COVERAGE_SEARCH_INCLUDES
    )
  ).filter((r) => r.resourceType !== 'Patient');

  // Payers are shared between patients, so each is resolved once. A payer that cannot be resolved costs
  // its patients the carrier name, not the whole report.
  const fhirInsuranceOrgs = all.filter((r): r is Organization => r.resourceType === 'Organization');
  const payorRefs = Array.from(new Set(getCoveragePayorReferences(all)));
  const insuranceOrgByRef = new Map<string, Organization>();

  let unresolvedPayers = 0;

  for (let i = 0; i < payorRefs.length; i += PAYER_LOOKUP_CONCURRENCY) {
    await Promise.all(
      payorRefs.slice(i, i + PAYER_LOOKUP_CONCURRENCY).map(async (ref) => {
        try {
          const [org] = await searchInsuranceInformation(oystehr, [ref], fhirInsuranceOrgs);

          if (org) {
            insuranceOrgByRef.set(ref, org);
          } else {
            unresolvedPayers++;
          }
        } catch (error) {
          unresolvedPayers++;
          console.warn(`[adhoc] could not resolve insurance payer ${ref}`, error);
        }
      })
    );
  }

  if (unresolvedPayers) console.warn(`[adhoc] ${unresolvedPayers} of ${payorRefs.length} insurance payers unresolved`);

  const resourcesOfPatient = indexAccountResources(all);

  for (const patient of patients) {
    if (!patient.id) continue;

    const patientRef = `Patient/${patient.id}`;
    const resources = resourcesOfPatient(patientRef);

    const insuranceOrgs = Array.from(
      new Set(getCoveragePayorReferences(resources).map((ref) => insuranceOrgByRef.get(ref)))
    ).filter((org): org is Organization => !!org);

    out.set(patientRef, assemblePatientAccountAndCoverageResources(patient, [patient, ...resources], insuranceOrgs));
  }

  return out;
}
