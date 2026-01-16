import { Patient, QuestionnaireResponse, QuestionnaireResponseItem } from 'fhir/r4b';
import { PREFERRED_PHARMACY_EXTENSION_URL } from 'utils';
import { expect } from 'vitest';
import { createMasterRecordPatchOperations, PATIENT_CONTAINED_PHARMACY_ID } from '../src/ehr/shared/harvest';
import patient1 from './data/patient-1.json';
import patient2 from './data/patient-2.json';
import patient3 from './data/patient-3.json';
import patient4 from './data/patient-4.json';
import QR1 from './data/questionnaire-response-1.json';
import QR2 from './data/questionnaire-response-2.json';
import QR3 from './data/questionnaire-response-3.json';
import QR4 from './data/questionnaire-response-4.json';
import QR5 from './data/questionnaire-response-5.json';
import QR6 from './data/questionnaire-response-6.json';
import QR7 from './data/questionnaire-response-7.json';
import QR8 from './data/questionnaire-response-8.json';

describe('Patient Master Record Tests', () => {
  test('should generate correct JSON patch operations for a new patient', () => {
    const patientPatchOperations = [
      {
        op: 'add',
        path: '/address',
        value: [
          {
            line: ['street address new'],
            city: 'Pembroke Pine',
            state: 'CA',
            postalCode: '06001',
          },
        ],
      },
      {
        op: 'add',
        path: '/telecom',
        value: [
          {
            system: 'email',
            value: 'okovalenko+testnew@masslight.com',
          },
          {
            system: 'phone',
            value: '+12027139680',
          },
        ],
      },
      {
        op: 'add',
        path: '/extension',
        value: [
          {
            url: 'https://fhir.zapehr.com/r4/StructureDefinitions/ethnicity',
            valueCodeableConcept: {
              coding: [
                {
                  system: 'http://terminology.hl7.org/CodeSystem/v3-Ethnicity',
                  code: '2135-2',
                  display: 'Hispanic or Latino',
                },
              ],
            },
          },
          {
            url: 'https://fhir.zapehr.com/r4/StructureDefinitions/race',
            valueCodeableConcept: {
              coding: [
                {
                  system: 'http://terminology.hl7.org/CodeSystem/v3-Race',
                  code: '1002-5',
                  display: 'American Indian or Alaska Native',
                },
              ],
            },
          },
        ],
      },
      {
        op: 'add',
        path: '/communication',
        value: [
          {
            language: {
              coding: [
                {
                  system: 'urn:ietf:bcp:47',
                  code: 'en',
                  display: 'English',
                },
              ],
            },
            preferred: true,
          },
        ],
      },
      {
        op: 'replace',
        path: '/name/0/given',
        value: ['Olha'],
      },
      {
        op: 'replace',
        path: '/name/0/family',
        value: 'Test0418',
      },
      {
        op: 'replace',
        path: '/birthDate',
        value: '2005-07-18',
      },
      {
        op: 'replace',
        path: '/gender',
        value: 'female',
      },
    ];

    const result = createMasterRecordPatchOperations((QR1 as QuestionnaireResponse).item ?? [], patient1 as Patient);

    expect(result).toEqual({
      coverage: {},
      patient: { conflictingUpdates: [], patchOpsForDirectUpdate: patientPatchOperations },
      relatedPerson: {},
    });
  });

  test('should not generate patch operations for a patient with already processed paperwork with the same answers', () => {
    const result = createMasterRecordPatchOperations((QR1 as QuestionnaireResponse).item ?? [], patient2 as Patient);

    expect(result).toEqual({
      coverage: {},
      patient: { conflictingUpdates: [], patchOpsForDirectUpdate: [] },
      relatedPerson: {},
    });
  });

  test('should generate correct JSON patch operations for an old patient with a paperwork, different answers', () => {
    const patientPatchOperations = [
      {
        op: 'replace',
        path: '/name/0/given',
        value: ['Olga'],
      },
      {
        op: 'replace',
        path: '/address/0/city',
        value: 'New York',
      },
      {
        op: 'replace',
        path: '/address/0/state',
        value: 'NY',
      },
      {
        op: 'replace',
        path: '/address/0/postalCode',
        value: '10001',
      },
      {
        op: 'replace',
        path: '/telecom/1/value',
        value: '+12027139681',
      },
    ];

    const result = createMasterRecordPatchOperations((QR3 as QuestionnaireResponse).item ?? [], patient2 as Patient);

    expect(result).toEqual({
      coverage: {},
      patient: { conflictingUpdates: [], patchOpsForDirectUpdate: patientPatchOperations },
      relatedPerson: {},
    });
  });
  test('should generate correct JSON patch operation to remove patient birth sex value', () => {
    const result = createMasterRecordPatchOperations((QR2 as QuestionnaireResponse).item ?? [], patient3 as Patient);

    expect(result).toEqual({
      coverage: {},
      patient: { conflictingUpdates: [], patchOpsForDirectUpdate: [{ op: 'remove', path: '/gender' }] },
      relatedPerson: {},
    });
  });
  test('should generate correct JSON patch operations to remove all not required data', () => {
    const patientPatchOperations = [
      { op: 'replace', path: '/name/0/given', value: ['George'] },
      { op: 'remove', path: '/name/0/suffix' },
      { op: 'remove', path: '/name/1' },
      { op: 'replace', path: '/address/0/line', value: ['Lincoln str., 21'] },
      { op: 'remove', path: '/communication' },
      {
        op: 'replace',
        path: '/extension',
        value: [
          {
            url: 'https://fhir.zapehr.com/r4/StructureDefinitions/ethnicity',
            valueCodeableConcept: {
              coding: [
                {
                  code: '2186-5',
                  system: 'http://terminology.hl7.org/CodeSystem/v3-Ethnicity',
                  display: 'Not Hispanic or Latino',
                },
              ],
            },
          },
          {
            url: 'https://fhir.zapehr.com/r4/StructureDefinitions/race',
            valueCodeableConcept: {
              coding: [
                {
                  code: '2028-9',
                  system: 'http://terminology.hl7.org/CodeSystem/v3-Race',
                  display: 'Asian',
                },
              ],
            },
          },
        ],
      },
      { op: 'remove', path: '/generalPractitioner' },
      { op: 'remove', path: '/contained' },
    ];

    const result = createMasterRecordPatchOperations((QR4 as QuestionnaireResponse).item ?? [], patient4 as Patient);

    expect(result).toEqual({
      coverage: {},
      patient: { conflictingUpdates: [], patchOpsForDirectUpdate: patientPatchOperations },
      relatedPerson: {},
    });
  });
  test('should generate correct JSON patch operations to remove not required PCP fields', () => {
    const patientPatchOperations = [
      {
        op: 'replace',
        path: '/contained',
        value: [
          {
            id: 'primary-care-physician',
            name: [
              {
                given: ['Elizabeth'],
                family: 'Ronda',
              },
            ],
            active: true,
            resourceType: 'Practitioner',
          },
        ],
      },
    ];

    const result = createMasterRecordPatchOperations((QR5 as QuestionnaireResponse).item ?? [], patient4 as Patient);

    expect(result).toEqual({
      coverage: {},
      patient: { conflictingUpdates: [], patchOpsForDirectUpdate: patientPatchOperations },
      relatedPerson: {},
    });
  });
  test('should generate correct JSON patch operations to deactivate PCP', () => {
    const patientPatchOperations = [
      {
        op: 'replace',
        path: '/contained',
        value: [
          {
            id: 'primary-care-physician',
            name: [
              {
                given: ['Elizabeth'],
                family: 'Ronda',
              },
            ],
            active: false,
            resourceType: 'Practitioner',
          },
        ],
      },
    ];

    const result = createMasterRecordPatchOperations((QR6 as QuestionnaireResponse).item ?? [], patient4 as Patient);

    expect(result).toEqual({
      coverage: {},
      patient: { conflictingUpdates: [], patchOpsForDirectUpdate: patientPatchOperations },
      relatedPerson: {},
    });
  });
  test('should not generate JSON patch operations in case with no PCP data but active flag set to true', () => {
    const result = createMasterRecordPatchOperations((QR7 as QuestionnaireResponse).item ?? [], patient1 as Patient);

    expect(result).toEqual({
      coverage: {},
      patient: { conflictingUpdates: [], patchOpsForDirectUpdate: [] },
      relatedPerson: {},
    });
  });
  test('should generate correct JSON patch operations to remove PCP completely when all information is cleared', () => {
    const patientPatchOperations = [
      {
        op: 'remove',
        path: '/generalPractitioner',
      },
      {
        op: 'remove',
        path: '/contained',
      },
    ];

    const result = createMasterRecordPatchOperations((QR8 as QuestionnaireResponse).item ?? [], patient4 as Patient);

    expect(result).toEqual({
      coverage: {},
      patient: { conflictingUpdates: [], patchOpsForDirectUpdate: patientPatchOperations },
      relatedPerson: {},
    });
  });
  test('should not drop pharmacy contained resource when adding PCP', () => {
    const patientWithPharmacy: Patient = {
      id: 'patient-with-pharmacy',
      resourceType: 'Patient',
      contained: [
        {
          id: PATIENT_CONTAINED_PHARMACY_ID,
          name: 'Existing Pharmacy',
          resourceType: 'Organization',
        },
      ],
      extension: [
        {
          url: PREFERRED_PHARMACY_EXTENSION_URL,
          valueReference: {
            reference: `#${PATIENT_CONTAINED_PHARMACY_ID}`,
          },
        },
      ],
    };

    const pcpItems: QuestionnaireResponseItem[] = [
      { linkId: 'pcp-first', answer: [{ valueString: 'Jane' }] },
      { linkId: 'pcp-last', answer: [{ valueString: 'Doe' }] },
    ];

    const result = createMasterRecordPatchOperations(pcpItems, patientWithPharmacy);

    expect(result).toEqual({
      coverage: {},
      patient: {
        conflictingUpdates: [],
        patchOpsForDirectUpdate: [
          {
            op: 'replace',
            path: '/contained',
            value: [
              {
                id: PATIENT_CONTAINED_PHARMACY_ID,
                name: 'Existing Pharmacy',
                resourceType: 'Organization',
              },
              {
                resourceType: 'Practitioner',
                id: 'primary-care-physician',
                name: [
                  {
                    family: 'Doe',
                    given: ['Jane'],
                  },
                ],
                active: true,
              },
            ],
          },
          {
            op: 'add',
            path: '/generalPractitioner',
            value: [{ reference: '#primary-care-physician', resourceType: 'Practitioner' }],
          },
        ],
      },
      relatedPerson: {},
    });
  });
});
