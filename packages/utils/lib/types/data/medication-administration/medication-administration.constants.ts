import { ottehrCodeSystemUrl } from '../../../fhir';

// todo review all this systems and codes
export const MEDICATION_TYPE_SYSTEM = 'virtual-medication-type';
export const INVENTORY_MEDICATION_TYPE_CODE = 'virtual-medication-inventory';

export const MEDICATION_IDENTIFIER_NAME_SYSTEM = 'virtual-medication-identifier-name-system';

export const MEDICATION_DISPENSABLE_DRUG_ID =
  'https://terminology.fhir.oystehr.com/CodeSystem/medispan-dispensable-drug-id';

export const MEDICATION_ADMINISTRATION_PERFORMER_TYPE_SYSTEM = 'performer-type';
export const PRACTITIONER_ORDERED_MEDICATION_CODE = 'practitioner-ordered-medication';
export const PRACTITIONER_ADMINISTERED_MEDICATION_CODE = 'practitioner-administered-medication';
export const PRACTITIONER_ORDERED_BY_MEDICATION_CODE = 'practitioner-ordered-by-medication';
export const MEDICATION_ADMINISTRATION_UNITS_SYSTEM = 'http://unitsofmeasure.org';
export const MEDICATION_ADMINISTRATION_ROUTES_CODES_SYSTEM = 'http://hl7.org/fhir/ValueSet/route-codes';

export const MEDICATION_ADMINISTRATION_CSS_RESOURCE_SYSTEM = 'css-medication-administration';
export const MEDICATION_ADMINISTRATION_CSS_RESOURCE_CODE = 'in-house-medication-administration-order';

export const MEDICATION_ADMINISTRATION_REASON_CODE = 'mainReason';
export const MEDICATION_ADMINISTRATION_OTHER_REASON_CODE = 'otherReason';

export const DATE_OF_MEDICATION_ADMINISTERED_SYSTEM = 'medication-administered-date';
export const TIME_OF_MEDICATION_ADMINISTERED_SYSTEM = 'medication-administered-time';

export const MEDICATION_APPLIANCE_LOCATION_SYSTEM = 'http://snomed.info/sct';
export const IN_HOUSE_CONTAINED_MEDICATION_ID = 'medicationId';
export const INTERACTION_OVERRIDE_REASON_CODE_SYSTEM = ottehrCodeSystemUrl('interaction-override-reason');
export const ISSUE_TYPE_CODE_SYSTEM = ottehrCodeSystemUrl('issue-type');
export const INTERACTIONS_UNAVAILABLE = 'interactions-unavailable';

export interface InHouseMedicationInfo {
  name: string;
  NDC: string;
  erxData: {
    id: string;
  };
}

export const InHouseMedicationsConfig: InHouseMedicationInfo[] = [
  { name: 'Acetaminophen (Liquid)', NDC: '50580-170-01', erxData: { id: '23562' } },
  { name: 'Acetaminophen (Tabs)', NDC: '71399-8024-1', erxData: { id: '23170' } },
  { name: 'Acetaminophen (80mg Suppository)', NDC: '51672-2114-2', erxData: { id: '23565' } },
  { name: 'Acetaminophen (325mg Suppository)', NDC: '51672-2116-2', erxData: { id: '23564' } },
  { name: 'Acetaminophen (120mg Suppository)', NDC: '45802-732-30', erxData: { id: '21887' } },
  { name: 'Activated Charcoal', NDC: '66689-203-04', erxData: { id: '32034' } },
  { name: 'Albuterol', NDC: '0487-9501-25', erxData: { id: '29518' } },
  { name: 'Ventolin HFA', NDC: '0173-0682-24', erxData: { id: '38526' } },
  { name: 'Amoxicillin', NDC: '0143-9887-01', erxData: { id: '34220' } },
  { name: 'Amoxicillin Clavulanate', NDC: '65862-535-75', erxData: { id: '22329' } },
];
