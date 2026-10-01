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

/** The resources one patient's own patient-account search returns, picked out of the bulk result. */
const resourcesOfPatient = (patientRef: string, all: AccountSearchResource[]): AccountSearchResource[] => {
  const accounts = all.filter(
    (r): r is Account => r.resourceType === 'Account' && getPatientReferenceFromAccount(r) === patientRef
  );

  const coverages = all.filter(
    (r): r is Coverage => r.resourceType === 'Coverage' && r.beneficiary?.reference === patientRef
  );

  const relatedPersons = all.filter(
    (r): r is RelatedPerson => r.resourceType === 'RelatedPerson' && r.patient?.reference === patientRef
  );

  // Organizations come in only as an Account owner or a Coverage payor; subscribers as a Coverage subscriber.
  const linked = new Set<string>(
    [
      ...accounts.map((a) => a.owner?.reference),
      ...coverages.flatMap((c) => [...c.payor.map((p) => p.reference), c.subscriber?.reference]),
    ].filter((ref): ref is string => !!ref)
  );

  const linkedResources = all.filter(
    (r) => (r.resourceType === 'Organization' || r.resourceType === 'RelatedPerson') && linked.has(referenceOf(r))
  );

  return [...accounts, ...coverages, ...relatedPersons, ...linkedResources];
};

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

  await Promise.all(
    payorRefs.map(async (ref) => {
      try {
        const [org] = await searchInsuranceInformation(oystehr, [ref], fhirInsuranceOrgs);
        if (org) insuranceOrgByRef.set(ref, org);
      } catch (error) {
        console.warn(`[adhoc] could not resolve insurance payer ${ref}`, error);
      }
    })
  );

  for (const patient of patients) {
    if (!patient.id) continue;

    const patientRef = `Patient/${patient.id}`;
    const resources = resourcesOfPatient(patientRef, all);

    const insuranceOrgs = Array.from(
      new Set(getCoveragePayorReferences(resources).map((ref) => insuranceOrgByRef.get(ref)))
    ).filter((org): org is Organization => !!org);

    out.set(patientRef, assemblePatientAccountAndCoverageResources(patient, [patient, ...resources], insuranceOrgs));
  }

  return out;
}
