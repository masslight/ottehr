import { Patient, Questionnaire, QuestionnaireResponse, QuestionnaireResponseItem } from 'fhir/r4b';
import { PREFERRED_PHARMACY_EXTENSION_URL } from 'utils';
import { describe, expect, test } from 'vitest';
import { createMasterRecordPatchOperations, PATIENT_CONTAINED_PHARMACY_ID } from '../src/ehr/shared/harvest';
import intakeQuestionnaire from './data/intake-paperwork-questionnaire.json';
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

const questionnaire = intakeQuestionnaire as Questionnaire;

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
    ];

    const result = createMasterRecordPatchOperations(
      {
        questionnaireResponseItems: (QR1 as QuestionnaireResponse).item ?? [],
        sourceQuestionnaire: questionnaire,
        options: { filterByEnableWhen: true },
      },
      patient1 as Patient
    );

    expect(result).toEqual({
      coverage: {},
      patient: { patchOpsForDirectUpdate: patientPatchOperations },
      relatedPerson: {},
    });
  });

  test('should not generate patch operations for a patient with already processed paperwork with the same answers', () => {
    const result = createMasterRecordPatchOperations(
      {
        questionnaireResponseItems: (QR1 as QuestionnaireResponse).item ?? [],
        sourceQuestionnaire: questionnaire,
        options: { filterByEnableWhen: true },
      },
      patient2 as Patient
    );

    expect(result).toEqual({
      coverage: {},
      patient: { patchOpsForDirectUpdate: [] },
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

    const result = createMasterRecordPatchOperations(
      {
        questionnaireResponseItems: (QR3 as QuestionnaireResponse).item ?? [],
        sourceQuestionnaire: questionnaire,
        options: { filterByEnableWhen: true },
      },
      patient2 as Patient
    );

    expect(result).toEqual({
      coverage: {},
      patient: { patchOpsForDirectUpdate: patientPatchOperations },
      relatedPerson: {},
    });
  });
  test('should generate correct JSON patch operation to remove patient birth sex value', () => {
    const result = createMasterRecordPatchOperations(
      {
        questionnaireResponseItems: (QR2 as QuestionnaireResponse).item ?? [],
        sourceQuestionnaire: questionnaire,
        options: { filterByEnableWhen: true },
      },
      patient3 as Patient
    );

    expect(result).toEqual({
      coverage: {},
      patient: { patchOpsForDirectUpdate: [{ op: 'remove', path: '/gender' }] },
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
          {
            url: 'https://fhir.zapehr.com/r4/StructureDefinitions/point-of-discovery',
            valueString: 'Been there with another family member',
          },
        ],
      },
      { op: 'remove', path: '/generalPractitioner' },
      { op: 'remove', path: '/contained' },
    ];

    const result = createMasterRecordPatchOperations(
      {
        questionnaireResponseItems: (QR4 as QuestionnaireResponse).item ?? [],
        sourceQuestionnaire: questionnaire,
        options: { filterByEnableWhen: true },
      },
      patient4 as Patient
    );

    expect(result).toEqual({
      coverage: {},
      patient: { patchOpsForDirectUpdate: patientPatchOperations },
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

    const result = createMasterRecordPatchOperations(
      {
        questionnaireResponseItems: (QR5 as QuestionnaireResponse).item ?? [],
        sourceQuestionnaire: questionnaire,
        options: { filterByEnableWhen: true },
      },
      patient4 as Patient
    );

    expect(result).toEqual({
      coverage: {},
      patient: { patchOpsForDirectUpdate: patientPatchOperations },
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

    const result = createMasterRecordPatchOperations(
      {
        questionnaireResponseItems: (QR6 as QuestionnaireResponse).item ?? [],
        sourceQuestionnaire: questionnaire,
        options: { filterByEnableWhen: true },
      },
      patient4 as Patient
    );

    expect(result).toEqual({
      coverage: {},
      patient: { patchOpsForDirectUpdate: patientPatchOperations },
      relatedPerson: {},
    });
  });
  test('should not generate JSON patch operations in case with no PCP data but active flag set to true', () => {
    const result = createMasterRecordPatchOperations(
      {
        questionnaireResponseItems: (QR7 as QuestionnaireResponse).item ?? [],
        sourceQuestionnaire: questionnaire,
        options: { filterByEnableWhen: true },
      },
      patient1 as Patient
    );

    expect(result).toEqual({
      coverage: {},
      patient: { patchOpsForDirectUpdate: [] },
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

    const result = createMasterRecordPatchOperations(
      {
        questionnaireResponseItems: (QR8 as QuestionnaireResponse).item ?? [],
        sourceQuestionnaire: questionnaire,
        options: { filterByEnableWhen: true },
      },
      patient4 as Patient
    );

    expect(result).toEqual({
      coverage: {},
      patient: { patchOpsForDirectUpdate: patientPatchOperations },
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

    const result = createMasterRecordPatchOperations(
      {
        questionnaireResponseItems: pcpItems,
        sourceQuestionnaire: questionnaire,
        options: { filterByEnableWhen: true },
      },
      patientWithPharmacy
    );

    expect(result).toEqual({
      coverage: {},
      patient: {
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

  test('should add SSN identifier when patient has no identifier field', () => {
    const patientNoIdentifier: Patient = {
      id: 'patient-no-identifier',
      resourceType: 'Patient',
      name: [{ given: ['John'], family: 'Doe' }],
    };

    const ssnItems: QuestionnaireResponseItem[] = [{ linkId: 'patient-ssn', answer: [{ valueString: '123-45-6789' }] }];

    const result = createMasterRecordPatchOperations(
      {
        questionnaireResponseItems: ssnItems,
        sourceQuestionnaire: questionnaire,
        options: { filterByEnableWhen: true },
      },
      patientNoIdentifier
    );

    expect(result).toEqual({
      coverage: {},
      patient: {
        patchOpsForDirectUpdate: [
          {
            op: 'add',
            path: '/identifier',
            value: [
              {
                system: 'http://hl7.org/fhir/sid/us-ssn',
                type: {
                  coding: [
                    {
                      system: 'http://terminology.hl7.org/CodeSystem/v2-0203',
                      code: 'SS',
                    },
                  ],
                },
                value: '123-45-6789',
              },
            ],
          },
        ],
      },
      relatedPerson: {},
    });
  });

  test('should append SSN identifier when patient has identifier field but no SSN entry', () => {
    const patientWithOtherIdentifier: Patient = {
      id: 'patient-with-other-identifier',
      resourceType: 'Patient',
      name: [{ given: ['Jane'], family: 'Smith' }],
      identifier: [
        {
          system: 'http://example.org/mrn',
          value: 'MRN-12345',
        },
      ],
    };

    const ssnItems: QuestionnaireResponseItem[] = [{ linkId: 'patient-ssn', answer: [{ valueString: '987-65-4321' }] }];

    const result = createMasterRecordPatchOperations(
      {
        questionnaireResponseItems: ssnItems,
        sourceQuestionnaire: questionnaire,
        options: { filterByEnableWhen: true },
      },
      patientWithOtherIdentifier
    );

    expect(result).toEqual({
      coverage: {},
      patient: {
        patchOpsForDirectUpdate: [
          {
            op: 'add',
            path: '/identifier/-',
            value: {
              system: 'http://hl7.org/fhir/sid/us-ssn',
              type: {
                coding: [
                  {
                    system: 'http://terminology.hl7.org/CodeSystem/v2-0203',
                    code: 'SS',
                  },
                ],
              },
              value: '987-65-4321',
            },
          },
        ],
      },
      relatedPerson: {},
    });
  });

  test('should replace entire SSN identifier when patient has existing SSN with different value', () => {
    const patientWithExistingSSN: Patient = {
      id: 'patient-with-existing-ssn',
      resourceType: 'Patient',
      name: [{ given: ['Bob'], family: 'Johnson' }],
      identifier: [
        {
          system: 'http://hl7.org/fhir/sid/us-ssn',
          type: {
            coding: [
              {
                system: 'http://terminology.hl7.org/CodeSystem/v2-0203',
                code: 'SS',
              },
            ],
          },
          value: '111-11-1111',
        },
      ],
    };

    const ssnItems: QuestionnaireResponseItem[] = [{ linkId: 'patient-ssn', answer: [{ valueString: '222-22-2222' }] }];

    const result = createMasterRecordPatchOperations(
      {
        questionnaireResponseItems: ssnItems,
        sourceQuestionnaire: questionnaire,
        options: { filterByEnableWhen: true },
      },
      patientWithExistingSSN
    );

    expect(result).toEqual({
      coverage: {},
      patient: {
        patchOpsForDirectUpdate: [
          {
            op: 'replace',
            path: '/identifier/0',
            value: {
              system: 'http://hl7.org/fhir/sid/us-ssn',
              type: {
                coding: [
                  {
                    system: 'http://terminology.hl7.org/CodeSystem/v2-0203',
                    code: 'SS',
                  },
                ],
              },
              value: '222-22-2222',
            },
          },
        ],
      },
      relatedPerson: {},
    });
  });

  test('should not generate patch operation when patient SSN matches questionnaire response', () => {
    const patientWithMatchingSSN: Patient = {
      id: 'patient-with-matching-ssn',
      resourceType: 'Patient',
      name: [{ given: ['Alice'], family: 'Williams' }],
      identifier: [
        {
          system: 'http://hl7.org/fhir/sid/us-ssn',
          type: {
            coding: [
              {
                system: 'http://terminology.hl7.org/CodeSystem/v2-0203',
                code: 'SS',
              },
            ],
          },
          value: '333-33-3333',
        },
      ],
    };

    const ssnItems: QuestionnaireResponseItem[] = [{ linkId: 'patient-ssn', answer: [{ valueString: '333-33-3333' }] }];

    const result = createMasterRecordPatchOperations(
      {
        questionnaireResponseItems: ssnItems,
        sourceQuestionnaire: questionnaire,
        options: { filterByEnableWhen: true },
      },
      patientWithMatchingSSN
    );

    expect(result).toEqual({
      coverage: {},
      patient: {
        patchOpsForDirectUpdate: [],
      },
      relatedPerson: {},
    });
  });

  test('should handle empty SSN answer, produce no patch operations', () => {
    const patientWithOtherIdentifier: Patient = {
      id: 'patient-with-other-identifier',
      resourceType: 'Patient',
      name: [{ given: ['Jane'], family: 'Smith' }],
      identifier: [
        {
          system: 'http://example.org/mrn',
          value: 'MRN-12345',
        },
      ],
    };
    const ssnItems: QuestionnaireResponseItem[] = [{ linkId: 'patient-ssn' }];

    // Patient with a non-SSN identifier: empty SSN should NOT remove the other identifier
    let result = createMasterRecordPatchOperations(
      { questionnaireResponseItems: ssnItems },
      patientWithOtherIdentifier
    );
    expect(result).toEqual({
      coverage: {},
      patient: {
        patchOpsForDirectUpdate: [],
      },
      relatedPerson: {},
    });

    // Patient with no identifiers: empty SSN is a no-op
    const patientWithNoIdentifier: Patient = {
      id: 'patient-with-no-identifier',
      resourceType: 'Patient',
      name: [{ given: ['Jane'], family: 'Smith' }],
    };
    result = createMasterRecordPatchOperations({ questionnaireResponseItems: ssnItems }, patientWithNoIdentifier);
    expect(result).toEqual({
      coverage: {},
      patient: {
        patchOpsForDirectUpdate: [],
      },
      relatedPerson: {},
    });

    // Patient with an existing SSN identifier (only identifier): empty SSN should remove /identifier entirely
    const patientWithSSNIdentifier: Patient = {
      id: 'patient-with-ssn-identifier',
      resourceType: 'Patient',
      name: [{ given: ['Jane'], family: 'Smith' }],
      identifier: [
        {
          system: 'http://hl7.org/fhir/sid/us-ssn',
          type: {
            coding: [
              {
                system: 'http://terminology.hl7.org/CodeSystem/v2-0203',
                code: 'SS',
              },
            ],
          },
          value: '444-44-4444',
        },
      ],
    };
    result = createMasterRecordPatchOperations({ questionnaireResponseItems: ssnItems }, patientWithSSNIdentifier);
    expect(result).toEqual({
      coverage: {},
      patient: {
        patchOpsForDirectUpdate: [{ op: 'remove', path: '/identifier' }],
      },
      relatedPerson: {},
    });

    // Patient with SSN + non-SSN identifiers: empty SSN should remove only the SSN, preserving the other
    const patientWithMixedIdentifiers: Patient = {
      id: 'patient-with-mixed-identifiers',
      resourceType: 'Patient',
      name: [{ given: ['Jane'], family: 'Smith' }],
      identifier: [
        {
          system: 'http://example.org/mrn',
          value: 'MRN-12345',
        },
        {
          system: 'http://hl7.org/fhir/sid/us-ssn',
          type: {
            coding: [
              {
                system: 'http://terminology.hl7.org/CodeSystem/v2-0203',
                code: 'SS',
              },
            ],
          },
          value: '444-44-4444',
        },
      ],
    };
    result = createMasterRecordPatchOperations({ questionnaireResponseItems: ssnItems }, patientWithMixedIdentifiers);
    expect(result).toEqual({
      coverage: {},
      patient: {
        patchOpsForDirectUpdate: [{ op: 'remove', path: '/identifier/1' }],
      },
      relatedPerson: {},
    });
  });
});
