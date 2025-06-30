import { Operation } from 'fast-json-patch';
import { Coverage, InsurancePlan, Organization, Patient, Reference, RelatedPerson } from 'fhir/r4b';
import { create } from 'zustand';

export interface Insurance {
  coverage: Coverage;
  relatedPerson: RelatedPerson;
  isTemp: true;
}

interface ResourcePatches {
  patient: Operation[];
  coverages: { [id: string]: Operation[] }; // key is Coverage.id
  relatedPersons: { [id: string]: Operation[] }; // key is RelatedPerson.id
}

export const eligibilityRequirementKeys = [
  'requiresSubscriberId',
  'requiresSubscriberName',
  'requiresSubscriberDOB',
  'requiresRelationshipToSubscriber',
  'requiresInsuranceName',
  'requiresInsuranceCardImage',
  'requiresFacilityNPI',
  'requiresStateUID',
  'enabledEligibilityCheck',
] as const;

export type InsurancePlanRequirementKeys = (typeof eligibilityRequirementKeys)[number];

export type InsurancePlanRequirementKeyBooleans = {
  [key in InsurancePlanRequirementKeys]: boolean;
};

export interface InsurancePlanDTO extends InsurancePlanRequirementKeyBooleans {
  id: string;
  name: string;
  ownedBy: Reference;
  payerId: string;
}

export interface GetInsurancesResponse {
  insurances: InsurancePlanDTO[];
}

type PatientState = {
  patient: Patient | null;
  insurances: Coverage[];
  policyHolders: RelatedPerson[];
  patchOperations: ResourcePatches;
  tempInsurances: Insurance[];
  insurancePlans: InsurancePlanDTO[];
};
interface PatientStoreActions {
  setPatient: (patient: Patient | null) => void;
  setInsurancePlans: (insurancePlans: InsurancePlanDTO[]) => void;
  reset: () => void;
}

const PATIENT_INITIAL: PatientState = {
  patient: null,
  insurances: [],
  policyHolders: [],
  tempInsurances: [],
  insurancePlans: [],
  patchOperations: {
    patient: [],
    coverages: {},
    relatedPersons: {},
  },
};

export const usePatientStore = create<PatientState & PatientStoreActions>()((set) => ({
  ...PATIENT_INITIAL,
  setPatient: (patient) => set({ patient }),
  setInsurancePlans: (insurancePlans) => set({ insurancePlans }),
  reset: () => {
    set({
      patchOperations: PATIENT_INITIAL.patchOperations,
    });
  },
}));

export const createInsurancePlanDto = (insurancePlan: InsurancePlan, organization: Organization): InsurancePlanDTO => {
  const { id, name, ownedBy, extension } = insurancePlan;

  if (!id || !name || !ownedBy) {
    throw new Error('Insurance is missing id, name or owning organization.');
  }

  const payerId = organization?.identifier
    ?.find((identifier) => identifier.type?.coding?.some((coding) => coding.system === 'payer-id'))
    ?.type?.coding?.find((coding) => coding.system === 'payer-id')?.code;

  if (!payerId) {
    throw new Error('Owning organization is missing payer-id.');
  }

  const insurancePlanDto: InsurancePlanDTO = {
    id,
    name,
    ownedBy,
    payerId,
    ...(Object.fromEntries(
      eligibilityRequirementKeys.map((key) => [key, false])
    ) as InsurancePlanRequirementKeyBooleans),
  };

  extension
    ?.find((extension) => extension.url === 'https://extensions.fhir.zapehr.com/insurance-requirements')
    ?.extension?.forEach((requirement) => {
      insurancePlanDto[requirement.url as InsurancePlanRequirementKeys] = requirement.valueBoolean || false;
    });

  return insurancePlanDto;
};
