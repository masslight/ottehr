import {
  Appointment,
  Claim,
  Coverage,
  DocumentReference,
  Encounter,
  FhirResource,
  InsurancePlan,
  Location,
  Organization,
  Patient,
  RelatedPerson,
} from 'fhir/r4b';
import { create } from 'zustand';
import {
  findResourceByType,
  findResourceByTypeAndId,
  getClaimData,
  getCoverageData,
  getPatientData,
  PlanOwnedBy,
} from '../../utils';

export type ClaimState = {
  claim?: Claim;
  claimData?: ReturnType<typeof getClaimData>;
  patient?: Patient;
  patientData?: ReturnType<typeof getPatientData>;
  appointment?: Appointment;
  coverage?: Coverage;
  coverageData?: ReturnType<typeof getCoverageData>;
  additionalCoverage?: Coverage;
  additionalCoverageData?: ReturnType<typeof getCoverageData>;
  encounter?: Encounter;
  subscriber?: RelatedPerson;
  additionalSubscriber?: RelatedPerson;
  insurancePlans?: InsurancePlan[];
  organizations?: Organization[];
  plansOwnedBy?: PlanOwnedBy[];
  facilities?: Location[];
  visitNoteDocument?: DocumentReference;
};

type ClaimStoreActions = {
  setResources: (data: FhirResource[]) => void;
  setPatientData: (patient?: Patient) => void;
  setCoverageData: (coverage?: Coverage, subscriber?: RelatedPerson) => void;
  setAdditionalCoverageData: (coverage?: Coverage, subscriber?: RelatedPerson) => void;
  setClaimData: (claim?: Claim) => void;
  setPlansOwnedBy: (insurancePlans: InsurancePlan[], organizations: Organization[]) => void;
};

const CLAIM_INITIAL: ClaimState = {};

export const useClaimStore = create<ClaimState & ClaimStoreActions>()((set, get) => ({
  ...CLAIM_INITIAL,
  setResources: (data) => {
    const claim = findResourceByType<Claim>(data, 'Claim');
    const encounter = findResourceByType<Encounter>(data, 'Encounter');
    const appointment = findResourceByType<Appointment>(data, 'Appointment');

    const patientReference = claim?.patient?.reference;
    const patient = findResourceByTypeAndId<Patient>(data, 'Patient', patientReference?.split('/')[1]);

    const coverageReference = claim?.insurance?.[0]?.coverage?.reference;
    const coverage = findResourceByTypeAndId<Coverage>(data, 'Coverage', coverageReference?.split('/')[1]);

    const subscriberReference = coverage?.subscriber?.reference;
    const subscriber = findResourceByTypeAndId<RelatedPerson>(
      data,
      subscriberReference?.split('/')[0],
      subscriberReference?.split('/')[1]
    );

    const additionalCoverageReference = claim?.insurance?.[1]?.coverage?.reference;
    const additionalCoverage = findResourceByTypeAndId<Coverage>(
      data,
      'Coverage',
      additionalCoverageReference?.split('/')[1]
    );

    const additionalSubscriberReference = additionalCoverage?.subscriber?.reference;
    const additionalSubscriber = findResourceByTypeAndId<RelatedPerson>(
      data,
      additionalSubscriberReference?.split('/')[0],
      additionalSubscriberReference?.split('/')[1]
    );

    const visitNoteDocument = data.find(
      (resource: FhirResource) =>
        resource.resourceType === 'DocumentReference' &&
        resource.type?.coding?.find((coding) => coding.code === '75498-6')
    ) as unknown as DocumentReference | undefined;

    const { setPatientData, setCoverageData, setAdditionalCoverageData, setClaimData } = get();

    setPatientData(patient);
    setCoverageData(coverage, subscriber);
    setAdditionalCoverageData(additionalCoverage, additionalSubscriber);
    setClaimData(claim);

    set({ encounter, appointment, visitNoteDocument });
  },
  setPatientData: (patient) => {
    const patientData = getPatientData(patient);

    set({ patient, patientData });
  },
  setCoverageData: (coverage, subscriber) => {
    const coverageData = getCoverageData(coverage, subscriber);

    set({ coverage, coverageData, subscriber });
  },
  setAdditionalCoverageData: (additionalCoverage, additionalSubscriber) => {
    const additionalCoverageData = getCoverageData(additionalCoverage, additionalSubscriber);

    set({ additionalCoverage, additionalCoverageData, additionalSubscriber });
  },
  setClaimData: (claim) => {
    const claimData = getClaimData(claim);

    set({ claim, claimData });
  },
  setPlansOwnedBy: (insurancePlans, organizations) => {
    const plansOwnedBy = insurancePlans?.map((plan) => ({
      ...plan,
      ownedBy: organizations.find((organization) => organization.id === plan.ownedBy?.reference?.split('/')[1]),
    }));

    set({ insurancePlans, organizations, plansOwnedBy });
  },
}));
