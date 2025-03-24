import { Operation } from 'fast-json-patch';
import {
  Coverage,
  FhirResource,
  InsurancePlan,
  Organization,
  Patient,
  PatientLink,
  Practitioner,
  Reference,
  RelatedPerson,
} from 'fhir/r4b';
import {
  getArrayInfo,
  getCurrentValue,
  getPatchOperationToRemoveExtension,
  extractExtensionValue,
  extractResourceTypeAndPath,
  getPatchOperationToAddOrUpdateExtension,
  ResourceTypeNames,
  PatientMasterRecordResourceType,
  patientFieldPaths,
  ContactTelecomConfig,
  LANGUAGE_OPTIONS,
  LanguageOption,
  getPatchOperationToAddOrUpdatePreferredLanguage,
  getPatchOperationToAddOrUpdateResponsiblePartyRelationship,
  RelationshipOption,
  RELATIONSHIP_OPTIONS,
  normalizePhoneNumber,
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

const patchOperationsMap: Record<PatientMasterRecordResourceType, keyof ResourcePatches> = {
  Patient: 'patient',
  Coverage: 'coverages',
  RelatedPerson: 'relatedPersons',
};

interface PatientStoreActions {
  setPatient: (patient: Patient | null) => void;
  setInsurances: (insurances: Coverage[]) => void;
  dropInsurance: (coverageId: string) => void;
  setPolicyHolders: (policyHolders: RelatedPerson[]) => void;
  setInsurancePlans: (insurancePlans: InsurancePlanDTO[]) => void;
  updatePatientField: (
    fieldName: string,
    value: string | boolean | Reference,
    resourceId?: string,
    fieldType?: string
  ) => void;
  addPatchOperation: (resourceType: PatientMasterRecordResourceType, operation: Operation, resourceId?: string) => void;
  addTempInsurance: (coverage: Coverage, relatedPerson: RelatedPerson) => void;
  updateTempInsurance: (coverageId: string, updatedInsurance: Insurance) => void;
  removeTempInsurance: (coverageId: string) => void;
  addPcp: (practitioner: Practitioner) => void;
  removePcp: () => void;
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
  setInsurances: (insurances) => set({ insurances }),
  dropInsurance: (coverageId: string) =>
    set((state) => {
      const coverage = state.insurances.find((insurance) => insurance.id === coverageId);
      if (!coverage) return state;

      return {
        insurances: state.insurances.filter((insurance) => insurance.id !== coverageId),
      };
    }),
  setPolicyHolders: (policyHolders) => set({ policyHolders }),
  addTempInsurance: (coverage, relatedPerson) =>
    set((state) => ({
      tempInsurances: [...state.tempInsurances, { coverage, relatedPerson, isTemp: true }],
    })),
  updateTempInsurance: (coverageId, updatedInsurance) =>
    set((state) => ({
      tempInsurances: state.tempInsurances.map((insurance) =>
        insurance.coverage.id === coverageId ? updatedInsurance : insurance
      ),
    })),
  removeTempInsurance: (coverageId) =>
    set((state) => ({
      tempInsurances: state.tempInsurances.filter((insurance) => insurance.coverage.id !== coverageId),
    })),
  setInsurancePlans: (insurancePlans) => set({ insurancePlans }),
  updatePatientField: (fieldName, value, resourceId, fieldType) => {
    if (fieldType === 'phone') {
      value = normalizePhoneNumber(value as string);
    }
    const state = usePatientStore.getState();
    const { resourceType, path } = extractResourceTypeAndPath(fieldName);

    let resource: Patient | Coverage | RelatedPerson | null = null;
    let currentPatchOperations: Operation[] = [];
    switch (resourceType) {
      case ResourceTypeNames.patient:
        resource = state.patient;
        currentPatchOperations = state.patchOperations.patient;
        break;
      case ResourceTypeNames.coverage:
        if (resourceId) {
          resource = state.insurances.find((i) => i.id === resourceId) as Coverage;
          currentPatchOperations = state.patchOperations.coverages[resourceId] || [];
        }
        break;
      case ResourceTypeNames.relatedPerson:
        if (resourceId) {
          resource = state.policyHolders.find((p) => p.id === resourceId) as RelatedPerson;
          currentPatchOperations = state.patchOperations.relatedPersons[resourceId] || [];
        }
        break;
    }

    if (!resource) return;

    const { isArray, parentPath } = getArrayInfo(path);
    const prefferedName = fieldType === 'prefferedName';
    const isTelecom = path.includes('/telecom/');
    const isResponsiblePartyBirthDate = path.match(/\/contact\/\d+\/extension\/0\/valueString$/);
    const isResponsiblePartyRelationship = path.match(/\/contact\/\d+\/relationship\//);
    const isPreferredLanguage = patientFieldPaths.preferredLanguage.includes(path);

    let newPatchOperation: Operation | undefined;

    // effectiveValue represents the current state after applying all previous patches
    const effectiveValue = getEffectiveValue(resource, path, currentPatchOperations);

    if (path.startsWith('/extension')) {
      const url = path.replace('/extension/', '');
      if (value === '') {
        //TODO: debug case where the extension was added in previous operations
        if (effectiveValue !== undefined && effectiveValue !== null) {
          newPatchOperation = getPatchOperationToRemoveExtension(resource, {
            url: url,
          });
        }
      } else {
        newPatchOperation = getPatchOperationToAddOrUpdateExtension(
          resource,
          {
            url: url,
            value: String(value),
          },
          effectiveValue
        );
      }
    } else if (isPreferredLanguage) {
      if (typeof value !== 'string') {
        throw new Error(`Invalid language value type: ${typeof value}`);
      }
      if (!(value in LANGUAGE_OPTIONS)) {
        throw new Error(
          `Invalid language option: ${value}. Expected one of: ${Object.keys(LANGUAGE_OPTIONS).join(', ')}`
        );
      }
      newPatchOperation = getPatchOperationToAddOrUpdatePreferredLanguage(
        value as LanguageOption,
        path,
        resource as Patient,
        effectiveValue as LanguageOption
      );
    } else if (prefferedName) {
      if (value === '') {
        if (effectiveValue !== undefined && effectiveValue !== null) {
          newPatchOperation = {
            op: 'remove',
            path: path.replace('/given/0', ''),
          };
        }
      } else {
        if (effectiveValue !== undefined) {
          newPatchOperation = { op: 'replace', path, value };
        } else {
          const prefferedNameItem = { given: [value], use: 'nickname' };
          newPatchOperation = {
            op: 'add',
            path: '/name/-',
            value: prefferedNameItem,
          };
        }
      }
    } else if (isArray && !path.match(/^\/contact\/\d+\/name\/given\/0$/)) {
      // ^skip contact name to process like general value
      const effectiveArrayValue = getEffectiveValue(resource, parentPath, state.patchOperations?.patient || []);
      const arrayMatch = path.match(/^(.+)\/(\d+)$/);

      if (arrayMatch) {
        const [, arrayPath, indexStr] = arrayMatch;
        const targetIndex = parseInt(indexStr);

        // Create array with the maximum possible length to preserve positions
        const currentArray = Array.isArray(effectiveArrayValue)
          ? [...effectiveArrayValue]
          : new Array(targetIndex + 1).fill(undefined);

        if (value === '') {
          // For removal, set to undefined but maintain array length
          currentArray[targetIndex] = undefined;
        } else {
          // Set value at the exact target index
          currentArray[targetIndex] = value;
        }

        // Clean up array while preserving positions
        const cleanArray = currentArray.filter((item, index) => item !== undefined || index < currentArray.length - 1);

        if (cleanArray.length > 0) {
          newPatchOperation = {
            op: effectiveArrayValue === undefined ? 'add' : 'replace',
            path: arrayPath,
            value: cleanArray,
          };
        } else {
          newPatchOperation = {
            op: 'remove',
            path: arrayPath,
          };
        }
      }
    } else if (isTelecom) {
      if (value === '') {
        if (effectiveValue !== undefined && effectiveValue !== null) {
          newPatchOperation = {
            op: 'remove',
            path: path,
          };
        }
      } else {
        if (effectiveValue !== undefined) {
          newPatchOperation = { op: 'replace', path, value };
        } else {
          if (path.startsWith('/contact/')) {
            const telecomConfig = contactTelecomConfigs[fieldType!];
            const telecomItem = { system: telecomConfig.system, value };
            newPatchOperation = {
              op: 'add',
              path: path.replace(/(\/telecom)\/(-1|\d+)\/value/, '$1'),
              value: [telecomItem],
            };
          } else {
            const telecomConfig = contactTelecomConfigs[fieldType!];
            const telecomItem = { system: telecomConfig.system, value };
            newPatchOperation = {
              op: 'add',
              path: path.replace(/(\/telecom)\/(-1|\d+)\/value/, '$1/-'),
              value: telecomItem,
            };
          }
        }
      }
    } else if (isResponsiblePartyBirthDate) {
      if (effectiveValue !== undefined) {
        newPatchOperation = { op: 'replace', path, value };
      } else {
        const url = 'https://fhir.zapehr.com/r4/StructureDefinitions/birth-date';
        newPatchOperation = {
          op: 'add',
          path: path.replace(/\/extension\/\d+\/valueString$/, '/extension'),
          value: [
            {
              url: url,
              valueString: value,
            },
          ],
        };
      }
    } else if (isResponsiblePartyRelationship) {
      if (typeof value !== 'string') {
        throw new Error(`Invalid responsible party relationship value type: ${typeof value}`);
      }
      if (!(value in RELATIONSHIP_OPTIONS)) {
        throw new Error(
          `Invalid responsible party relationship option: ${value}. Expected one of: ${Object.keys(
            RELATIONSHIP_OPTIONS
          ).join(', ')}`
        );
      }
      newPatchOperation = getPatchOperationToAddOrUpdateResponsiblePartyRelationship(
        value as RelationshipOption,
        path,
        effectiveValue as RelationshipOption
      );
    } else {
      if (value === '') {
        // Only generate remove operation if there's actually something to remove
        if (effectiveValue !== undefined && effectiveValue !== null) {
          newPatchOperation = {
            op: 'remove',
            path: path,
          };
        }
      } else if (value !== effectiveValue) {
        newPatchOperation = { op: effectiveValue === undefined ? 'add' : 'replace', path, value };
      }
    }

    if (newPatchOperation) {
      state.addPatchOperation(resourceType as PatientMasterRecordResourceType, newPatchOperation, resourceId);
    }
  },
  addPatchOperation: (resourceType, operation, resourceId) => {
    set((state) => {
      const targetKey = patchOperationsMap[resourceType];

      if (resourceType === ResourceTypeNames.patient) {
        return {
          patchOperations: {
            ...state.patchOperations,
            patient: [...(state.patchOperations?.patient || []), operation],
          },
        };
      }

      if (!resourceId) {
        console.error(`resourceId is missing for ${resourceType} operations`);
        return state;
      }
      const targetMap =
        resourceType === ResourceTypeNames.coverage
          ? state.patchOperations?.coverages
          : state.patchOperations?.relatedPersons;

      return {
        patchOperations: {
          ...state.patchOperations,
          [targetKey]: {
            ...targetMap,
            [resourceId]: [...(targetMap?.[resourceId] || []), operation],
          },
        },
      };
    });
  },
  removePcp: () => {
    set((state) => {
      if (!state.patient) {
        return { ...state };
      }

      const updatedContained = state.patient.contained?.filter(
        (containedResource) => containedResource.id !== 'primary-care-physician'
      );

      const updatedLink = state.patient.link?.filter(
        (linkResource) => linkResource.other?.reference !== '#primary-care-physician'
      );

      return {
        ...state,
        patient: {
          ...state.patient,
          contained: updatedContained,
          link: updatedLink,
        },
      };
    });
  },
  addPcp: (practitioner) => {
    set((state) => {
      if (!state.patient) {
        return { ...state };
      }

      const updatedContained: FhirResource[] = [...(state.patient.contained || []), practitioner];

      const updatedLink: PatientLink[] = [
        ...(state.patient.link || []),
        {
          type: 'refer',
          other: {
            reference: `#${practitioner.id}`,
          },
        },
      ];

      return {
        ...state,
        patient: {
          ...state.patient,
          contained: updatedContained,
          link: updatedLink,
        },
      };
    });
  },
  reset: () => {
    set({
      patchOperations: PATIENT_INITIAL.patchOperations,
    });
  },
}));

const getEffectiveValue = (
  resource: Patient | Coverage | RelatedPerson,
  path: string,
  patchOperations: Operation[]
): any => {
  let effectiveValue = getCurrentValue(resource, path);

  if (path.startsWith('/extension/')) {
    const extensionUrl = path.replace('/extension/', '');
    let lastKnownIndex: number | null = null;

    patchOperations.forEach((operation) => {
      // Handle both numeric indices and '-' in the path
      const match = operation.path.match(/^\/extension\/(\d+|-)$/);
      if (match) {
        const operationPath = match[1];

        // For '-' operations, we're adding to the end
        if (operationPath === '-') {
          if (operation.op === 'add' && operation.value.url === extensionUrl) {
            // Track that this extension exists and update its value
            effectiveValue = extractExtensionValue(operation.value);
            lastKnownIndex = resource.extension?.length || 0;
          }
        } else {
          // For numeric indices
          const operationIndex = parseInt(operationPath);
          const extensionAtIndex = resource.extension?.[operationIndex];

          if (extensionAtIndex?.url === extensionUrl || lastKnownIndex === operationIndex) {
            switch (operation.op) {
              case 'remove':
                effectiveValue = undefined;
                lastKnownIndex = null;
                break;
              case 'replace':
              case 'add':
                effectiveValue = extractExtensionValue(operation.value);
                lastKnownIndex = operationIndex;
                break;
            }
          }
        }
      }
    });
  } else {
    // Regular field handling
    patchOperations.forEach((operation) => {
      if (operation.path === path) {
        switch (operation.op) {
          case 'remove':
            effectiveValue = undefined;
            break;
          case 'replace':
          case 'add':
            effectiveValue = operation.value;
            break;
        }
      }
    });
  }

  return effectiveValue;
};

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

const contactTelecomConfigs: Record<string, ContactTelecomConfig> = {
  phone: { system: 'phone' },
  email: { system: 'email' },
};

export const getTelecomInfo = (
  patient: Patient,
  system: 'phone' | 'email',
  defaultIndex: number
): { value?: string; path: string } => {
  let index: number;

  if (!patient.telecom) {
    index = defaultIndex;
  } else {
    const matches = patient.telecom.map((telecom, i) => (telecom.system === system ? i : -1)).filter((i) => i !== -1);

    index = matches.length > 0 ? matches[matches.length - 1] : -1;
  }

  return {
    value: patient.telecom?.[index]?.value,
    path: patientFieldPaths[system].replace(/telecom\/\d+/, `telecom/${index}`),
  };
};
