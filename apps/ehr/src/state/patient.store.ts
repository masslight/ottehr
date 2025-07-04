import { Operation } from 'fast-json-patch';
import { Coverage, Organization, Patient, RelatedPerson } from 'fhir/r4b';
import {
  eligibilityRequirementKeys,
  getPayerId,
  InsurancePlanDTO,
  InsurancePlanRequirementKeyBooleans,
  InsurancePlanRequirementKeys,
} from 'utils';
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

export const createInsurancePlanDto = (organization: Organization): InsurancePlanDTO => {
  const { id, name, partOf, extension } = organization;

  if (!id || !name) {
    throw new Error('Insurance is missing id, name or owning organization.');
  }

  const payerId = getPayerId(organization);

  if (!payerId) {
    throw new Error('Owning organization is missing payer-id.');
  }

  const insurancePlanDto: InsurancePlanDTO = {
    id,
    name,
    ownedBy: partOf,
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
