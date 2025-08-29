// cSpell:ignore rawAGQR1, rawPPHQR1, rawSPHQR1
import { BatchInputPostRequest } from '@oystehr/sdk';
import { Account, Coverage, Organization, Patient, QuestionnaireResponse, RelatedPerson } from 'fhir/r4b';
import { DateTime } from 'luxon';
import {
  COVERAGE_MEMBER_IDENTIFIER_BASE,
  flattenItems,
  isValidUUID,
  ORG_TYPE_CODE_SYSTEM,
  ORG_TYPE_PAYER_CODE,
} from 'utils';
import InPersonQuestionnaireFile from 'utils/lib/deployed-resources/questionnaires/in-person-intake-questionnaire.json';
import { v4 as uuidV4 } from 'uuid';
import { assert, describe, expect, it } from 'vitest';
import {
  createAccount,
  createContainedGuarantor,
  extractAccountGuarantor,
  getAccountOperations,
  GetAccountOperationsOutput,
  getCoverageResources,
  getCoverageUpdateResourcesFromUnbundled,
  getPrimaryPolicyHolderFromAnswers,
  getSecondaryPolicyHolderFromAnswers,
  resolveCoverageUpdates,
  resolveGuarantor,
} from '../src/ehr/shared/harvest';
import {
  expectedAccountGuarantorFromQR1 as rawAGQR1,
  expectedPrimaryPolicyHolderFromQR1 as rawPPHQR1,
  expectedSecondaryPolicyHolderFromQR1 as rawSPHQR1,
} from './data/expected-coverage-resources-qr1';
import { fillReferences } from './helpers/harvest-test-helpers';

const InPersonQuestionnaire = InPersonQuestionnaireFile.resource;

const expectedPrimaryPolicyHolderFromQR1 = fillReferences(rawPPHQR1, ['Patient/36ef99c2-43fa-40f6-bf9c-d9ea12c2bf61']);
const expectedSecondaryPolicyHolderFromQR1 = fillReferences(rawSPHQR1, [
  'Patient/36ef99c2-43fa-40f6-bf9c-d9ea12c2bf61',
]);
const expectedAccountGuarantorFromQR1 = fillReferences(rawAGQR1, ['Patient/36ef99c2-43fa-40f6-bf9c-d9ea12c2bf61']);

describe('Harvest Module', () => {
  const { orderedCoverages: coverageResources, accountCoverage } = getCoverageResources({
    questionnaireResponse: questionnaireResponse1,
    patientId: newPatient1.id ?? '',
    organizationResources: organizations1,
  });
  const primary = coverageResources.primary;
  const secondary = coverageResources.secondary;
  expect(primary).toBeDefined();
  expect(secondary).toBeDefined();
  assert(primary);
  assert(secondary);

  const expectedAccount: Account = {
    resourceType: 'Account',
    type: {
      coding: [
        {
          system: 'http://terminology.hl7.org/CodeSystem/account-type',
          code: 'PBILLACCT',
          display: 'patient billing account',
        },
      ],
    },
    contained: [
      {
        resourceType: 'RelatedPerson',
        id: 'accountGuarantorId',
        name: [{ given: ['Jane'], family: 'Doe' }],
        birthDate: '1983-02-23',
        gender: 'female',
        patient: { reference: `Patient/${newPatient1.id}` },
        address: [
          {
            city: 'fakePlace',
            line: ['123 test lane'],
            postalCode: '11111',
            state: 'NY',
          },
        ],
        relationship: [
          {
            coding: [
              {
                system: 'http://hl7.org/fhir/ValueSet/relatedperson-relationshiptype',
                code: 'parent',
                display: 'Parent',
              },
            ],
          },
        ],
        telecom: [
          {
            system: 'phone',
            value: '+19895556543',
          },
          {
            system: 'email',
            value: 'rowdyroddypiper@hotmail.com',
          },
        ],
      },
    ],
    status: 'active',
    subject: [{ reference: `Patient/${newPatient1.id}` }],
    description: 'Patient account',
    guarantor: [
      {
        party: {
          reference: '#accountGuarantorId',
          type: 'RelatedPerson',
        },
      },
    ],
    coverage: [
      {
        coverage: { reference: `${primary.id}` },
        priority: 1,
      },
      {
        coverage: { reference: `${secondary.id}` },
        priority: 2,
      },
    ],
  };
  it('should pass this stub test', () => {
    expect(true).toBe(true);
  });

  it('should extract primary policy holder information from answers', () => {
    const expectedPrimaryPolicyHolder = {
      firstName: 'Barnabas',
      middleName: 'Thaddeus',
      lastName: 'PicklesWorth',
      dob: '1982-02-23',
      birthSex: 'Male',
      address: {
        line: ['317 Mustard Street', 'Unit 2'],
        city: 'DeliciousVilla',
        state: 'DE',
        postalCode: '20001',
      },
      relationship: 'Child',
      memberId: 'FafOneJwgNdkOetWwe6',
    };

    const flattened = flattenItems((questionnaireResponse1.item as QuestionnaireResponse['item']) ?? []);
    const primaryPolicyHolder = getPrimaryPolicyHolderFromAnswers(flattened);
    expect(primaryPolicyHolder).toEqual(expectedPrimaryPolicyHolder);
  });

  it('should extract secondary policy holder information from answers', () => {
    const expectedSecondaryPolicyHolder = {
      firstName: 'Jennifer',
      middleName: 'Celeste',
      lastName: 'PicklesWorth',
      dob: '1983-02-23',
      birthSex: 'Female',
      address: {
        line: ['317 R St NW Unit 2', 'conditional-filter-test-1234'],
        city: 'Washington',
        state: 'DC',
        postalCode: '20001',
      },
      relationship: 'Child',
      memberId: 'FdfDfdFdfDfh7897',
    };
    const flattened = flattenItems((questionnaireResponse1.item as QuestionnaireResponse['item']) ?? []);
    const secondaryPolicyHolder = getSecondaryPolicyHolderFromAnswers(flattened);
    expect(secondaryPolicyHolder).toEqual(expectedSecondaryPolicyHolder);
  });

  it('should extract account guarantor information from answers', () => {
    const expectedAccountGuarantor = {
      firstName: 'Jane',
      lastName: 'Doe',
      dob: '1983-02-23',
      address: {
        city: 'fakePlace',
        line: ['123 test lane'],
        postalCode: '11111',
        state: 'NY',
      },
      relationship: 'Parent',
      birthSex: 'Female',
      number: '(989) 555-6543',
      email: 'rowdyroddypiper@hotmail.com',
    };

    const flattened = flattenItems((questionnaireResponse1.item as QuestionnaireResponse['item']) ?? []);
    const accountGuarantor = extractAccountGuarantor(flattened);
    expect(accountGuarantor).toEqual(expectedAccountGuarantor);
  });

  it('should extract coverage resources from answers', () => {
    const expectedCoverageResources = {
      primary: {
        resourceType: 'Coverage',
        identifier: [
          {
            ...COVERAGE_MEMBER_IDENTIFIER_BASE, // this holds the 'type'
            value: 'FafOneJwgNdkOetWwe6',
            assigner: {
              reference: 'Organization/db875d9d-5726-4c45-a689-e11a7bbdf176',
              display: 'Aetna',
            },
          },
        ],
        contained: [expectedPrimaryPolicyHolderFromQR1],
        status: 'active',
        beneficiary: { reference: 'Patient/36ef99c2-43fa-40f6-bf9c-d9ea12c2bf61', type: 'Patient' },
        payor: [{ reference: 'Organization/db875d9d-5726-4c45-a689-e11a7bbdf176' }],
        subscriberId: 'FafOneJwgNdkOetWwe6',
        subscriber: {
          reference: `#coverageSubscriber`,
        },
        relationship: {
          coding: [
            {
              system: 'http://terminology.hl7.org/CodeSystem/subscriber-relationship',
              code: 'child',
              display: 'Child',
            },
          ],
        },
        class: [
          {
            name: 'Aetna',
            type: {
              coding: [
                {
                  code: 'plan',
                  system: 'http://terminology.hl7.org/CodeSystem/coverage-class',
                },
              ],
            },
            value: '60054',
          },
        ],
        type: {
          coding: [
            {
              code: '09',
              system: 'https://fhir.ottehr.com/CodeSystem/candid-plan-type',
            },
            {
              code: 'pay',
              system: 'http://terminology.hl7.org/CodeSystem/coverage-selfpay',
            },
          ],
        },
        extension: [
          {
            url: 'https://fhir.zapehr.com/r4/StructureDefinitions/additional-information',
            valueString: 'Additional info to primary insurance',
          },
        ],
      },
      secondary: {
        resourceType: 'Coverage',
        identifier: [
          {
            ...COVERAGE_MEMBER_IDENTIFIER_BASE, // this holds the 'type'
            value: 'FdfDfdFdfDfh7897',
            assigner: {
              reference: 'Organization/a9bada42-935a-45fa-ba8e-aa3b29478884',
              display: 'United Heartland',
            },
          },
        ],
        contained: [expectedSecondaryPolicyHolderFromQR1],
        status: 'active',
        beneficiary: { reference: 'Patient/36ef99c2-43fa-40f6-bf9c-d9ea12c2bf61', type: 'Patient' },
        payor: [{ reference: 'Organization/a9bada42-935a-45fa-ba8e-aa3b29478884' }],
        subscriberId: 'FdfDfdFdfDfh7897',
        subscriber: { reference: '#coverageSubscriber' },
        relationship: {
          coding: [
            {
              system: 'http://terminology.hl7.org/CodeSystem/subscriber-relationship',
              code: 'child',
              display: 'Child',
            },
          ],
        },
        class: [
          {
            name: 'United Heartland',
            type: {
              coding: [
                {
                  code: 'plan',
                  system: 'http://terminology.hl7.org/CodeSystem/coverage-class',
                },
              ],
            },
            value: 'J1859',
          },
        ],
        type: {
          coding: [
            {
              code: '12',
              system: 'https://fhir.ottehr.com/CodeSystem/candid-plan-type',
            },
            {
              code: 'PPO',
              system: 'http://terminology.hl7.org/CodeSystem/v3-ActCode',
            },
          ],
        },
        extension: [
          {
            url: 'https://fhir.zapehr.com/r4/StructureDefinitions/additional-information',
            valueString: 'Additional info to secondary insurance',
          },
        ],
      },
    };

    const { orderedCoverages: coverageResources } = getCoverageResources({
      questionnaireResponse: questionnaireResponse1,
      patientId: newPatient1.id ?? '',
      organizationResources: organizations1,
    });
    expect(coverageResources).toBeDefined();
    const primary = coverageResources.primary;
    const secondary = coverageResources.secondary;
    expect(primary).toBeDefined();
    expect(secondary).toBeDefined();
    assert(primary);
    assert(secondary);
    expect(primary.status).toBe('active');
    expect(secondary.status).toBe('active');

    expect(primary.beneficiary.reference).toBe(`Patient/${newPatient1.id}`);
    expect(secondary.beneficiary.reference).toBe(`Patient/${newPatient1.id}`);

    expect(primary.payor?.[0].reference).toBe(expectedCoverageResources.primary.payor?.[0].reference);
    expect(secondary.payor?.[0].reference).toBe(expectedCoverageResources.secondary.payor?.[0].reference);

    expect(primary.subscriberId).toBe('FafOneJwgNdkOetWwe6');
    expect(secondary.subscriberId).toBe('FdfDfdFdfDfh7897');
    expect(primary.subscriber?.reference).toBe(`#${primary.contained?.[0].id}`);
    expect(secondary.subscriber?.reference).toBe(`#${secondary.contained?.[0].id}`);

    expect(primary.relationship?.coding?.[0].code).toBe('child');
    expect(secondary.relationship?.coding?.[0].code).toBe('child');

    expect(primary.contained?.length).toBe(1);
    expect(secondary.contained?.length).toBe(1);

    expect(primary.contained?.[0].resourceType).toBe('RelatedPerson');
    expect(secondary.contained?.[0].resourceType).toBe('RelatedPerson');
    expect((primary.contained?.[0] as RelatedPerson)?.name?.[0].given?.[0]).toBe('Barnabas');
    expect((secondary.contained?.[0] as RelatedPerson)?.name?.[0].given?.[0]).toBe('Jennifer');
    expect(primary.contained?.[0].id).toBe('coverageSubscriber');
    expect(secondary.contained?.[0].id).toBe('coverageSubscriber');
    expect(primary.contained).toEqual(expectedCoverageResources.primary.contained);
    expect(secondary.contained).toEqual(expectedCoverageResources.secondary.contained);
    expect(primary.extension).toEqual(expectedCoverageResources.primary.extension);
    expect(secondary.extension).toEqual(expectedCoverageResources.secondary.extension);

    expect(primary.relationship).toEqual(expectedCoverageResources.primary.relationship);
    expect(secondary.relationship).toEqual(expectedCoverageResources.secondary.relationship);

    expect({ ...primary, id: undefined }).toEqual(expectedCoverageResources.primary);
    expect({ ...secondary, id: undefined }).toEqual(expectedCoverageResources.secondary);
    expect(primary.id?.startsWith('urn:uuid:')).toBe(true);
    expect(secondary.id?.startsWith('urn:uuid:')).toBe(true);
    const uuidPrimary = (primary.id ?? '').split(':').pop()!;
    const uuidSecondary = (secondary.id ?? '').split(':').pop()!;
    expect(isValidUUID(uuidPrimary)).toBe(true);
    expect(isValidUUID(uuidSecondary)).toBe(true);
  });
  it('should create an account with the correct details', () => {
    const flattened = flattenItems((questionnaireResponse1.item as QuestionnaireResponse['item']) ?? []);
    const accountGuarantor = extractAccountGuarantor(flattened);
    assert(accountGuarantor);

    const containedGuarantorResource = createContainedGuarantor(accountGuarantor, newPatient1.id ?? '');
    const guarantor = [
      {
        party: {
          reference: `#${containedGuarantorResource.id}`,
          type: 'RelatedPerson',
        },
      },
    ];

    const account = createAccount({
      patientId: newPatient1.id ?? '',
      guarantor,
      coverage: accountCoverage,
      contained: [containedGuarantorResource],
    });
    expect(account).toBeDefined();
    expect(account.resourceType).toBe('Account');
    expect(account.status).toBe('active');
    expect(account.subject?.[0]?.reference).toBe(`Patient/${newPatient1.id}`);
    expect(account.contained?.length).toBe(1);
    expect(account.coverage?.length).toBe(2);
    const primaryCoverage = account.coverage?.[0];
    const secondaryCoverage = account.coverage?.[1];
    assert(primaryCoverage && secondaryCoverage);

    expect(primaryCoverage?.coverage?.reference).toBe(primary.id);
    expect(secondaryCoverage?.coverage?.reference).toBe(secondary.id);

    expect(primaryCoverage?.priority).toBe(1);
    expect(secondaryCoverage?.priority).toBe(2);
    expect(account.description).toBe('Patient account');

    const containedGuarantor = account.contained?.[0];
    assert(containedGuarantor);
    expect(containedGuarantor).toEqual(expectedAccount.contained?.[0]);

    expect(account).toEqual(expectedAccount);
  });
  describe('should generate the right output when comparing resources from form with existing resources', () => {
    const flattened = flattenItems((questionnaireResponse1.item as QuestionnaireResponse['item']) ?? []);
    const accountGuarantor = extractAccountGuarantor(flattened);
    assert(accountGuarantor);
    const { orderedCoverages: coverages, accountCoverage } = getCoverageResources({
      questionnaireResponse: questionnaireResponse1,
      patientId: newPatient1.id ?? '',
      organizationResources: organizations1,
    });

    const containedGuarantor = createContainedGuarantor(accountGuarantor, newPatient1.id ?? '');
    const guarantor = [
      {
        party: {
          reference: `#${containedGuarantor.id}`,
          type: 'RelatedPerson',
        },
      },
    ];
    const account = createAccount({
      patientId: newPatient1.id ?? '',
      guarantor,
      coverage: accountCoverage,
      contained: [containedGuarantor],
    });
    assert(account);

    const primary: Coverage = {
      resourceType: 'Coverage',
      id: uuidV4(),
      status: 'active',
      beneficiary: { reference: 'Patient/36ef99c2-43fa-40f6-bf9c-d9ea12c2bf61', type: 'Patient' },
      payor: [{ reference: 'Organization/db875d9d-5726-4c45-a689-e11a7bbdf176' }],
      subscriberId: 'FafOneJwgNdkOetWwe6',
      subscriber: { reference: 'RelatedPerson/36ef99c3-43fb-50f4-bf9d-d9ea12c2bf62' },
      order: 1,
      identifier: [
        {
          ...COVERAGE_MEMBER_IDENTIFIER_BASE,
          value: 'FafOneJwgNdkOetWwe6',
          assigner: {
            reference: 'Organization/db875d9d-5726-4c45-a689-e11a7bbdf176',
            display: 'Aetna',
          },
        },
      ],
      relationship: {
        coding: [
          {
            system: 'http://terminology.hl7.org/CodeSystem/subscriber-relationship',
            code: 'child',
            display: 'Child',
          },
        ],
      },
      class: [
        {
          name: 'Aetna',
          type: {
            coding: [
              {
                code: 'plan',
                system: 'http://terminology.hl7.org/CodeSystem/coverage-class',
              },
            ],
          },
          value: '60054',
        },
      ],
      type: {
        coding: [
          {
            code: '09',
            system: 'https://fhir.ottehr.com/CodeSystem/candid-plan-type',
          },
          {
            code: 'pay',
            system: 'http://terminology.hl7.org/CodeSystem/coverage-selfpay',
          },
        ],
      },
      extension: [
        {
          url: 'https://fhir.zapehr.com/r4/StructureDefinitions/additional-information',
          valueString: 'Additional info to primary insurance',
        },
      ],
    };
    const primarySubscriber: RelatedPerson = {
      resourceType: 'RelatedPerson',
      id: uuidV4(),
      name: [
        {
          given: ['Barnabas', 'Thaddeus'],
          family: 'PicklesWorth',
        },
      ],
      birthDate: '1982-02-23',
      gender: 'male',
      patient: { reference: 'Patient/36ef99c2-43fa-40f6-bf9c-d9ea12c2bf61' },
      relationship: [
        {
          coding: [
            {
              system: 'http://hl7.org/fhir/ValueSet/relatedperson-relationshiptype',
              code: 'child',
              display: 'Child',
            },
          ],
        },
      ],
      address: [
        {
          line: ['317 Mustard Street', 'Unit 2'],
          city: 'DeliciousVilla',
          state: 'DE',
          postalCode: '20001',
        },
      ],
    };

    const secondary: Coverage = {
      resourceType: 'Coverage',
      id: uuidV4(),
      status: 'active',
      beneficiary: { reference: 'Patient/36ef99c2-43fa-40f6-bf9c-d9ea12c2bf61', type: 'Patient' },
      payor: [{ reference: 'Organization/a9bada42-935a-45fa-ba8e-aa3b29478884' }],
      subscriberId: 'FdfDfdFdfDfh7897',
      subscriber: { reference: 'RelatedPerson/36ef99c3-43fa-40f4-bf9c-d9ea12c2bf63' },
      order: 1,
      identifier: [
        {
          ...COVERAGE_MEMBER_IDENTIFIER_BASE,
          value: 'FdfDfdFdfDfh7897',
          assigner: {
            reference: 'Organization/a9bada42-935a-45fa-ba8e-aa3b29478884',
            display: 'United Heartland',
          },
        },
      ],
      relationship: {
        coding: [
          {
            system: 'http://terminology.hl7.org/CodeSystem/subscriber-relationship',
            code: 'child',
            display: 'Child',
          },
        ],
      },
      class: [
        {
          name: 'United Heartland',
          type: {
            coding: [
              {
                code: 'plan',
                system: 'http://terminology.hl7.org/CodeSystem/coverage-class',
              },
            ],
          },
          value: 'J1859',
        },
      ],
      type: {
        coding: [
          {
            code: '12',
            system: 'https://fhir.ottehr.com/CodeSystem/candid-plan-type',
          },
          {
            code: 'PPO',
            system: 'http://terminology.hl7.org/CodeSystem/v3-ActCode',
          },
        ],
      },
      extension: [
        {
          url: 'https://fhir.zapehr.com/r4/StructureDefinitions/additional-information',
          valueString: 'Additional info to secondary insurance',
        },
      ],
    };
    const secondarySubscriber: RelatedPerson = {
      resourceType: 'RelatedPerson',
      id: uuidV4(),
      name: [
        {
          given: ['Jennifer', 'Celeste'],
          family: 'PicklesWorth',
        },
      ],
      birthDate: '1983-02-23',
      gender: 'female',
      patient: { reference: 'Patient/36ef99c2-43fa-40f6-bf9c-d9ea12c2bf61' },
      relationship: [
        {
          coding: [
            {
              system: 'http://hl7.org/fhir/ValueSet/relatedperson-relationshiptype',
              code: 'child',
              display: 'Child',
            },
          ],
        },
      ],
      address: [
        {
          line: ['317 R St NW Unit 2', 'conditional-filter-test-1234'],
          city: 'Washington',
          state: 'DC',
          postalCode: '20001',
        },
      ],
    };

    describe('should generate the right output when comparing new coverages against existing primary coverage', () => {
      it('should return no patches when subscriber and coverage match new values exactly', () => {
        const existingCoverages = {
          primary,
          primarySubscriber,
        };

        const result = resolveCoverageUpdates({
          existingCoverages,
          newCoverages: coverages,
          patient: newPatient1,
        });
        const { suggestedNewCoverageObject, deactivatedCoverages, coverageUpdates, relatedPersonUpdates } = result;
        expect(suggestedNewCoverageObject).toBeDefined();
        expect(suggestedNewCoverageObject?.length).toBe(2);
        assert(suggestedNewCoverageObject);
        expect(suggestedNewCoverageObject.find((c) => c.priority === 1)).toBeDefined();
        expect(suggestedNewCoverageObject.find((c) => c.priority === 2)).toBeDefined();
        expect(deactivatedCoverages).toBeDefined();
        expect(deactivatedCoverages?.length).toBe(0);
        expect(coverageUpdates).toBeDefined();
        expect(Object.keys(coverageUpdates).length).toBe(0);
        expect(relatedPersonUpdates).toBeDefined();

        // there can be entries with empty arrays here. the important thing is that the length of all actual operations is 0
        expect(Object.values(relatedPersonUpdates).flatMap((v) => v).length).toBe(0);
      });

      it('should return no patches when subscribers match and existing value has data not found in input', () => {
        const existingSubscriber: RelatedPerson = {
          ...primarySubscriber,
          telecom: [
            {
              value: 'is.aol.still.cool@aol.com',
              system: 'email',
            },
          ],
        };
        const existingCoverages = {
          primary,
          primarySubscriber: existingSubscriber,
        };

        const result = resolveCoverageUpdates({ patient: newPatient1, existingCoverages, newCoverages: coverages });
        const { suggestedNewCoverageObject, deactivatedCoverages, coverageUpdates, relatedPersonUpdates } = result;
        expect(suggestedNewCoverageObject).toBeDefined();
        expect(suggestedNewCoverageObject?.length).toBe(2);
        expect(deactivatedCoverages).toBeDefined();
        expect(deactivatedCoverages?.length).toBe(0);
        expect(coverageUpdates).toBeDefined();
        expect(Object.keys(coverageUpdates).length).toBe(0);
        expect(relatedPersonUpdates).toBeDefined();
        // there can be entries with empty arrays here. the important thing is that the length of all actual operations is 0
        expect(Object.values(relatedPersonUpdates).flatMap((v) => v).length).toBe(0);
      });

      it('should return patches when subscribers match and existing value is changed by input', () => {
        const existingSubscriber: RelatedPerson = {
          ...primarySubscriber,
          relationship: [
            {
              coding: [
                {
                  system: 'http://hl7.org/fhir/ValueSet/relatedperson-relationshiptype',
                  code: 'parent',
                  display: 'Parent',
                },
              ],
            },
          ],
        };
        const existingCoverages = {
          primary,
          primarySubscriber: existingSubscriber,
        };

        const result = resolveCoverageUpdates({ patient: newPatient1, existingCoverages, newCoverages: coverages });
        const { suggestedNewCoverageObject, deactivatedCoverages, coverageUpdates, relatedPersonUpdates } = result;
        expect(suggestedNewCoverageObject).toBeDefined();
        expect(suggestedNewCoverageObject?.length).toBe(2);
        assert(suggestedNewCoverageObject);
        expect(suggestedNewCoverageObject.find((c) => c.priority === 1)).toBeDefined();
        expect(suggestedNewCoverageObject.find((c) => c.priority === 2)).toBeDefined();
        expect(deactivatedCoverages).toBeDefined();
        expect(deactivatedCoverages?.length).toBe(0);
        expect(coverageUpdates).toBeDefined();
        expect(Object.keys(coverageUpdates).length).toBe(0);
        expect(relatedPersonUpdates).toBeDefined();

        expect(Object.values(relatedPersonUpdates).flatMap((v) => v).length).toBe(1);
        const update = Object.values(relatedPersonUpdates)[0]?.[0];
        assert(update);
        expect(update.op).toBe('replace');
        expect(update.path).toBe('/relationship');
        expect((update as any).value).toEqual([
          {
            coding: [
              {
                system: 'http://hl7.org/fhir/ValueSet/relatedperson-relationshiptype',
                code: 'child',
                display: 'Child',
              },
            ],
          },
        ]);
      });

      it('should combine a new address rather than overwriting existing address when a new address is sent in input', () => {
        const existingSubscriber: RelatedPerson = {
          ...primarySubscriber,
          address: [
            {
              line: ['456 Bluegrass Lane', 'Suite 300'],
              city: 'Lexington',
              state: 'KY',
              postalCode: '40507',
            },
          ],
        };
        const existingCoverages = {
          primary,
          primarySubscriber: existingSubscriber,
        };

        const result = resolveCoverageUpdates({ patient: newPatient1, existingCoverages, newCoverages: coverages });
        const { suggestedNewCoverageObject, deactivatedCoverages, coverageUpdates, relatedPersonUpdates } = result;
        expect(suggestedNewCoverageObject).toBeDefined();
        assert(suggestedNewCoverageObject);
        expect(suggestedNewCoverageObject.find((c) => c.priority === 1)).toBeDefined();
        expect(suggestedNewCoverageObject.find((c) => c.priority === 2)).toBeDefined();
        expect(suggestedNewCoverageObject?.length).toBe(2);
        expect(deactivatedCoverages).toBeDefined();
        expect(deactivatedCoverages?.length).toBe(0);
        expect(coverageUpdates).toBeDefined();
        expect(Object.keys(coverageUpdates).length).toBe(0);
        expect(relatedPersonUpdates).toBeDefined();

        expect(Object.values(relatedPersonUpdates).flatMap((v) => v).length).toBe(1);
        const update = Object.values(relatedPersonUpdates)[0]?.[0];
        assert(update);
        expect(update.op).toBe('replace');
        expect(update.path).toBe('/address');
        expect((update as any).value).toEqual([
          {
            line: ['317 Mustard Street', 'Unit 2'],
            city: 'DeliciousVilla',
            state: 'DE',
            postalCode: '20001',
          },
          {
            line: ['456 Bluegrass Lane', 'Suite 300'],
            city: 'Lexington',
            state: 'KY',
            postalCode: '40507',
          },
        ]);
      });
      it('should use a new contained RelatedPerson on Coverage when matching data differs between old and new subscriber, but coverage should be reused if it already exists', () => {
        const existingSubscriber: RelatedPerson = {
          ...primarySubscriber,
          birthDate: '1999-09-09',
        };
        const existingCoverages = {
          primary,
          primarySubscriber: existingSubscriber,
        };

        const result = resolveCoverageUpdates({ patient: newPatient1, existingCoverages, newCoverages: coverages });
        const { suggestedNewCoverageObject, deactivatedCoverages, coverageUpdates, relatedPersonUpdates } = result;
        expect(suggestedNewCoverageObject).toBeDefined();
        assert(suggestedNewCoverageObject);
        expect(suggestedNewCoverageObject.find((c) => c.priority === 1)).toBeDefined();
        expect(suggestedNewCoverageObject.find((c) => c.priority === 2)).toBeDefined();
        expect(suggestedNewCoverageObject?.length).toBe(2);
        expect(deactivatedCoverages).toBeDefined();
        expect(deactivatedCoverages?.length).toBe(0);
        expect(coverageUpdates).toBeDefined();
        expect(Object.keys(coverageUpdates).length).toBe(1);
        expect(relatedPersonUpdates).toBeDefined();

        expect(Object.values(relatedPersonUpdates).flatMap((v) => v).length).toBe(0);
        expect(Object.values(coverageUpdates).flatMap((v) => v).length).toBe(2);
        const coverageUpdate1 = Object.values(coverageUpdates).flatMap((v) => v)[0];
        const coverageUpdate2 = Object.values(coverageUpdates).flatMap((v) => v)[1];
        assert(coverageUpdate1);
        assert(coverageUpdate2);
        expect(coverageUpdate1.op).toBe('add');
        expect(coverageUpdate1.path).toBe('/contained');
        expect((coverageUpdate1 as any).value).toEqual([expectedPrimaryPolicyHolderFromQR1]);
        expect(coverageUpdate2.op).toBe('replace');
        expect(coverageUpdate2.path).toBe('/subscriber');
        expect((coverageUpdate2 as any).value).toEqual({
          reference: `#${expectedPrimaryPolicyHolderFromQR1.id}`,
        });

        expect(suggestedNewCoverageObject?.[0].coverage).toBeDefined();
        expect(suggestedNewCoverageObject?.[1].coverage).toBeDefined();

        const newPrimaryCoverage = suggestedNewCoverageObject?.[0].coverage;
        const newSecondaryCoverage = suggestedNewCoverageObject?.[1].coverage;
        assert(newPrimaryCoverage);
        assert(newSecondaryCoverage);
        expect(newPrimaryCoverage.reference).toBe(`Coverage/${existingCoverages.primary.id}`);
        expect(newSecondaryCoverage.reference).toBe(`${coverages.secondary?.id}`);
      });
    });

    describe('should generate the right output when comparing Account against existing secondary coverage', () => {
      it('should return no patches when subscriber and coverage match new values exactly', () => {
        const existingCoverages = {
          secondary,
          secondarySubscriber,
        };

        const result = resolveCoverageUpdates({ patient: newPatient1, existingCoverages, newCoverages: coverages });
        const { suggestedNewCoverageObject, deactivatedCoverages, coverageUpdates, relatedPersonUpdates } = result;
        expect(suggestedNewCoverageObject).toBeDefined();
        assert(suggestedNewCoverageObject);
        expect(suggestedNewCoverageObject.find((c) => c.priority === 1)).toBeDefined();
        expect(suggestedNewCoverageObject.find((c) => c.priority === 2)).toBeDefined();
        expect(suggestedNewCoverageObject?.length).toBe(2);
        expect(deactivatedCoverages).toBeDefined();
        expect(deactivatedCoverages?.length).toBe(0);
        expect(coverageUpdates).toBeDefined();
        expect(Object.keys(coverageUpdates).length).toBe(0);
        expect(relatedPersonUpdates).toBeDefined();

        // there can be entries with empty arrays here. the important thing is that the length of all actual operations is 0
        expect(Object.values(relatedPersonUpdates).flatMap((v) => v).length).toBe(0);
      });
      it('should return no patches when subscribers match and existing value has data not found in input', () => {
        const existingSubscriber: RelatedPerson = {
          ...secondarySubscriber,
          telecom: [
            {
              value: 'is_aol_still_cool@aol.com',
              system: 'email',
            },
          ],
        };
        const existingCoverages = {
          secondary,
          secondarySubscriber: existingSubscriber,
        };

        const result = resolveCoverageUpdates({ patient: newPatient1, existingCoverages, newCoverages: coverages });
        const { suggestedNewCoverageObject, deactivatedCoverages, coverageUpdates, relatedPersonUpdates } = result;
        expect(suggestedNewCoverageObject).toBeDefined();
        assert(suggestedNewCoverageObject);
        expect(suggestedNewCoverageObject.find((c) => c.priority === 1)).toBeDefined();
        expect(suggestedNewCoverageObject.find((c) => c.priority === 2)).toBeDefined();
        expect(suggestedNewCoverageObject?.length).toBe(2);
        expect(deactivatedCoverages).toBeDefined();
        expect(deactivatedCoverages?.length).toBe(0);
        expect(coverageUpdates).toBeDefined();
        expect(Object.keys(coverageUpdates).length).toBe(0);
        expect(relatedPersonUpdates).toBeDefined();
        // there can be entries with empty arrays here. the important thing is that the length of all actual operations is 0
        expect(Object.values(relatedPersonUpdates).flatMap((v) => v).length).toBe(0);
      });
      it('should return patches when subscribers match and existing value is changed by input', () => {
        const existingSubscriber: RelatedPerson = {
          ...secondarySubscriber,
          relationship: [
            {
              coding: [
                {
                  system: 'http://hl7.org/fhir/ValueSet/relatedperson-relationshiptype',
                  code: 'spouse',
                  display: 'Spouse',
                },
              ],
            },
          ],
        };
        const existingCoverages = {
          secondary,
          secondarySubscriber: existingSubscriber,
        };

        const result = resolveCoverageUpdates({ patient: newPatient1, existingCoverages, newCoverages: coverages });
        const { suggestedNewCoverageObject, deactivatedCoverages, coverageUpdates, relatedPersonUpdates } = result;
        expect(suggestedNewCoverageObject).toBeDefined();
        assert(suggestedNewCoverageObject);
        expect(suggestedNewCoverageObject.find((c) => c.priority === 1)).toBeDefined();
        expect(suggestedNewCoverageObject.find((c) => c.priority === 2)).toBeDefined();
        expect(suggestedNewCoverageObject?.length).toBe(2);
        expect(deactivatedCoverages).toBeDefined();
        expect(deactivatedCoverages?.length).toBe(0);
        expect(coverageUpdates).toBeDefined();
        expect(Object.keys(coverageUpdates).length).toBe(0);
        expect(relatedPersonUpdates).toBeDefined();

        expect(Object.values(relatedPersonUpdates).flatMap((v) => v).length).toBe(1);
        const update = Object.values(relatedPersonUpdates)[0]?.[0];
        assert(update);
        expect(update.op).toBe('replace');
        expect(update.path).toBe('/relationship');
        expect((update as any).value).toEqual([
          {
            coding: [
              {
                system: 'http://hl7.org/fhir/ValueSet/relatedperson-relationshiptype',
                code: 'child',
                display: 'Child',
              },
            ],
          },
        ]);
      });
      it('should combine a new address rather than overwriting existing address when a new address is sent in input', () => {
        const existingSubscriber: RelatedPerson = {
          ...secondarySubscriber,
          address: [
            {
              line: ['456 Bluegrass Lane', 'Suite 300'],
              city: 'Lexington',
              state: 'KY',
              postalCode: '40507',
            },
          ],
        };
        const existingCoverages = {
          secondary,
          secondarySubscriber: existingSubscriber,
        };

        const result = resolveCoverageUpdates({ patient: newPatient1, existingCoverages, newCoverages: coverages });
        const { suggestedNewCoverageObject, deactivatedCoverages, coverageUpdates, relatedPersonUpdates } = result;
        expect(suggestedNewCoverageObject).toBeDefined();
        assert(suggestedNewCoverageObject);
        expect(suggestedNewCoverageObject.find((c) => c.priority === 1)).toBeDefined();
        expect(suggestedNewCoverageObject.find((c) => c.priority === 2)).toBeDefined();
        expect(suggestedNewCoverageObject?.length).toBe(2);
        expect(deactivatedCoverages).toBeDefined();
        expect(deactivatedCoverages?.length).toBe(0);
        expect(coverageUpdates).toBeDefined();
        expect(Object.keys(coverageUpdates).length).toBe(0);
        expect(relatedPersonUpdates).toBeDefined();

        expect(Object.values(relatedPersonUpdates).flatMap((v) => v).length).toBe(1);
        const update = Object.values(relatedPersonUpdates)[0]?.[0];
        assert(update);
        expect(update.op).toBe('replace');
        expect(update.path).toBe('/address');
        expect((update as any).value).toEqual([
          {
            line: ['317 R St NW Unit 2', 'conditional-filter-test-1234'],
            city: 'Washington',
            state: 'DC',
            postalCode: '20001',
          },
          {
            line: ['456 Bluegrass Lane', 'Suite 300'],
            city: 'Lexington',
            state: 'KY',
            postalCode: '40507',
          },
        ]);
      });
      it('should use a new contained RelatedPerson on Coverage when matching data differs between old and new subscriber, but coverage should be reused if it already exists', () => {
        const existingSubscriber: RelatedPerson = {
          ...secondarySubscriber,
          birthDate: '1999-09-09',
        };
        const existingCoverages = {
          secondary,
          secondarySubscriber: existingSubscriber,
        };

        const result = resolveCoverageUpdates({ patient: newPatient1, existingCoverages, newCoverages: coverages });
        const { suggestedNewCoverageObject, deactivatedCoverages, coverageUpdates, relatedPersonUpdates } = result;
        expect(suggestedNewCoverageObject).toBeDefined();
        assert(suggestedNewCoverageObject);
        expect(suggestedNewCoverageObject.find((c) => c.priority === 1)).toBeDefined();
        expect(suggestedNewCoverageObject.find((c) => c.priority === 2)).toBeDefined();
        expect(suggestedNewCoverageObject?.length).toBe(2);
        expect(deactivatedCoverages).toBeDefined();
        expect(deactivatedCoverages?.length).toBe(0);
        expect(coverageUpdates).toBeDefined();
        expect(Object.keys(coverageUpdates).length).toBe(1);
        expect(relatedPersonUpdates).toBeDefined();

        expect(Object.values(relatedPersonUpdates).flatMap((v) => v).length).toBe(0);
        expect(Object.values(coverageUpdates).flatMap((v) => v).length).toBe(2);
        const coverageUpdate1 = Object.values(coverageUpdates).flatMap((v) => v)[0];
        const coverageUpdate2 = Object.values(coverageUpdates).flatMap((v) => v)[1];
        assert(coverageUpdate1);
        assert(coverageUpdate2);
        expect(coverageUpdate1.op).toBe('add');
        expect(coverageUpdate1.path).toBe('/contained');
        expect((coverageUpdate1 as any).value).toEqual([expectedSecondaryPolicyHolderFromQR1]);
        expect(coverageUpdate2.op).toBe('replace');
        expect(coverageUpdate2.path).toBe('/subscriber');
        expect((coverageUpdate2 as any).value).toEqual({
          reference: `#${expectedSecondaryPolicyHolderFromQR1.id}`,
        });
      });
    });
    describe('should generate the right output when comparing Account against existing primary and secondary coverage', () => {
      it('should return no patches when subscribers and coverage match new values exactly', () => {
        const existingCoverages = {
          primary,
          primarySubscriber,
          secondary,
          secondarySubscriber,
        };

        const result = resolveCoverageUpdates({ patient: newPatient1, existingCoverages, newCoverages: coverages });
        const { suggestedNewCoverageObject, deactivatedCoverages, coverageUpdates, relatedPersonUpdates } = result;
        expect(suggestedNewCoverageObject).toBeDefined();
        assert(suggestedNewCoverageObject);
        expect(suggestedNewCoverageObject.find((c) => c.priority === 1)).toBeDefined();
        expect(suggestedNewCoverageObject.find((c) => c.priority === 2)).toBeDefined();
        expect(suggestedNewCoverageObject?.length).toBe(2);
        expect(deactivatedCoverages).toBeDefined();
        expect(deactivatedCoverages?.length).toBe(0);
        expect(coverageUpdates).toBeDefined();
        expect(Object.keys(coverageUpdates).length).toBe(0);
        expect(relatedPersonUpdates).toBeDefined();
        // there can be entries with empty arrays here. the important thing is that the length of all actual operations is 0
        expect(Object.values(relatedPersonUpdates).flatMap((v) => v).length).toBe(0);
      });
      it('should return no patches when subscribers match and existing value has data not found in input', () => {
        const existingPrimarySubscriber: RelatedPerson = {
          ...primarySubscriber,
          telecom: [
            {
              value: 'is_hotmail_in_still@hotmail.com',
              system: 'email',
            },
          ],
        };
        const existingSecondarySubscriber: RelatedPerson = {
          ...secondarySubscriber,
          telecom: [
            {
              value: 'im_cooler_than_all_my_boomer_friends@yahoo.com',
              system: 'email',
            },
          ],
        };
        const existingCoverages = {
          primary,
          primarySubscriber: existingPrimarySubscriber,
          secondary,
          secondarySubscriber: existingSecondarySubscriber,
        };
        const result = resolveCoverageUpdates({ patient: newPatient1, existingCoverages, newCoverages: coverages });
        const { suggestedNewCoverageObject, deactivatedCoverages, coverageUpdates, relatedPersonUpdates } = result;
        expect(suggestedNewCoverageObject).toBeDefined();
        assert(suggestedNewCoverageObject);
        expect(suggestedNewCoverageObject.find((c) => c.priority === 1)).toBeDefined();
        expect(suggestedNewCoverageObject.find((c) => c.priority === 2)).toBeDefined();
        expect(suggestedNewCoverageObject?.length).toBe(2);
        expect(deactivatedCoverages).toBeDefined();
        expect(deactivatedCoverages?.length).toBe(0);
        expect(coverageUpdates).toBeDefined();
        expect(Object.keys(coverageUpdates).length).toBe(0);
        expect(relatedPersonUpdates).toBeDefined();
        // there can be entries with empty arrays here. the important thing is that the length of all actual operations is 0
        expect(Object.values(relatedPersonUpdates).flatMap((v) => v).length).toBe(0);
      });
      it('should return patches when subscribers match and existing value is changed by input', () => {
        const existingPrimarySubscriber: RelatedPerson = {
          ...primarySubscriber,
          relationship: [
            {
              coding: [
                {
                  system: 'http://hl7.org/fhir/ValueSet/relatedperson-relationshiptype',
                  code: 'parent',
                  display: 'Parent',
                },
              ],
            },
          ],
        };
        const existingSecondarySubscriber: RelatedPerson = {
          ...secondarySubscriber,
          relationship: [
            {
              coding: [
                {
                  system: 'http://hl7.org/fhir/ValueSet/relatedperson-relationshiptype',
                  code: 'parent',
                  display: 'Parent',
                },
              ],
            },
          ],
        };
        const existingCoverages = {
          primary,
          primarySubscriber: existingPrimarySubscriber,
          secondary,
          secondarySubscriber: existingSecondarySubscriber,
        };

        const result = resolveCoverageUpdates({ patient: newPatient1, existingCoverages, newCoverages: coverages });
        const { suggestedNewCoverageObject, deactivatedCoverages, coverageUpdates, relatedPersonUpdates } = result;
        expect(suggestedNewCoverageObject).toBeDefined();
        expect(suggestedNewCoverageObject?.length).toBe(2);
        assert(suggestedNewCoverageObject);
        const primaryCoverageObject = suggestedNewCoverageObject.find((c) => c.priority === 1);
        expect(primaryCoverageObject).toBeDefined();
        const secondaryCoverageObject = suggestedNewCoverageObject.find((c) => c.priority === 2);
        expect(secondaryCoverageObject).toBeDefined();
        expect(primaryCoverageObject?.coverage?.reference).toBeDefined();
        expect(secondaryCoverageObject?.coverage?.reference).toBeDefined();
        expect(primaryCoverageObject?.coverage?.reference).toBe(`Coverage/${existingCoverages.primary.id}`);
        expect(secondaryCoverageObject?.coverage?.reference).toBe(`Coverage/${existingCoverages.secondary.id}`);
        expect(deactivatedCoverages).toBeDefined();
        expect(deactivatedCoverages).toBeDefined();
        expect(deactivatedCoverages?.length).toBe(0);
        expect(coverageUpdates).toBeDefined();
        expect(Object.keys(coverageUpdates).length).toBe(0);
        expect(relatedPersonUpdates).toBeDefined();
        expect(Object.keys(relatedPersonUpdates).length).toBe(2);

        expect(Object.values(relatedPersonUpdates).flatMap((v) => v).length).toBe(2);
        const update1 = Object.values(relatedPersonUpdates)[0]?.[0];
        const update2 = Object.values(relatedPersonUpdates)[1]?.[0];
        assert(update1);
        assert(update2);
        expect(update1.op).toBe('replace');
        expect(update1.path).toBe('/relationship');
        expect((update1 as any).value).toEqual([
          {
            coding: [
              {
                system: 'http://hl7.org/fhir/ValueSet/relatedperson-relationshiptype',
                code: 'child',
                display: 'Child',
              },
            ],
          },
        ]);
        expect(update2.op).toBe('replace');
        expect(update2.path).toBe('/relationship');
        expect((update2 as any).value).toEqual([
          {
            coding: [
              {
                system: 'http://hl7.org/fhir/ValueSet/relatedperson-relationshiptype',
                code: 'child',
                display: 'Child',
              },
            ],
          },
        ]);
      });
      it('should combine a new address rather than overwriting existing address when a new address is sent in input', () => {
        const existingPrimarySubscriber: RelatedPerson = {
          ...primarySubscriber,
          address: [
            {
              line: ['456 Bluegrass Lane', 'Suite 300'],
              city: 'Lexington',
              state: 'KY',
              postalCode: '40507',
            },
          ],
        };
        const existingSecondarySubscriber: RelatedPerson = {
          ...secondarySubscriber,
          address: [
            {
              line: ['789 Potato Lane', 'Suite 300'],
              city: 'Boise',
              state: 'ID',
              postalCode: '83701',
            },
          ],
        };
        const existingCoverages = {
          primary,
          primarySubscriber: existingPrimarySubscriber,
          secondary,
          secondarySubscriber: existingSecondarySubscriber,
        };

        const result = resolveCoverageUpdates({ patient: newPatient1, existingCoverages, newCoverages: coverages });
        const { suggestedNewCoverageObject, deactivatedCoverages, coverageUpdates, relatedPersonUpdates } = result;
        expect(suggestedNewCoverageObject).toBeDefined();
        assert(suggestedNewCoverageObject);
        expect(suggestedNewCoverageObject.find((c) => c.priority === 1)).toBeDefined();
        expect(suggestedNewCoverageObject.find((c) => c.priority === 2)).toBeDefined();
        expect(suggestedNewCoverageObject?.length).toBe(2);
        expect(deactivatedCoverages).toBeDefined();
        expect(deactivatedCoverages?.length).toBe(0);
        expect(coverageUpdates).toBeDefined();
        expect(Object.keys(coverageUpdates).length).toBe(0);
        expect(relatedPersonUpdates).toBeDefined();

        expect(Object.values(relatedPersonUpdates).flatMap((v) => v).length).toBe(2);
        const update1 = Object.values(relatedPersonUpdates)[0]?.[0];
        const update2 = Object.values(relatedPersonUpdates)[1]?.[0];
        assert(update1);
        assert(update2);
        expect(update1.op).toBe('replace');
        expect(update1.path).toBe('/address');
        expect((update1 as any).value).toEqual([
          {
            line: ['317 Mustard Street', 'Unit 2'],
            city: 'DeliciousVilla',
            state: 'DE',
            postalCode: '20001',
          },
          {
            line: ['456 Bluegrass Lane', 'Suite 300'],
            city: 'Lexington',
            state: 'KY',
            postalCode: '40507',
          },
        ]);
        expect(update2.op).toBe('replace');
        expect(update2.path).toBe('/address');
        expect((update2 as any).value).toEqual([
          {
            line: ['317 R St NW Unit 2', 'conditional-filter-test-1234'],
            city: 'Washington',
            state: 'DC',
            postalCode: '20001',
          },
          {
            line: ['789 Potato Lane', 'Suite 300'],
            city: 'Boise',
            state: 'ID',
            postalCode: '83701',
          },
        ]);
      });
      it('should use a new contained RelatedPerson on Coverage when matching data differs between old and new subscriber, but coverage should be reused if it already exists', () => {
        const existingPrimarySubscriber: RelatedPerson = {
          ...primarySubscriber,
          birthDate: '1999-09-09',
        };
        const existingSecondarySubscriber: RelatedPerson = {
          ...secondarySubscriber,
          birthDate: '1999-09-09',
        };
        const existingCoverages = {
          primary,
          primarySubscriber: existingPrimarySubscriber,
          secondary,
          secondarySubscriber: existingSecondarySubscriber,
        };

        const result = resolveCoverageUpdates({ patient: newPatient1, existingCoverages, newCoverages: coverages });
        const { suggestedNewCoverageObject, deactivatedCoverages, coverageUpdates, relatedPersonUpdates } = result;
        expect(suggestedNewCoverageObject).toBeDefined();
        assert(suggestedNewCoverageObject);
        expect(suggestedNewCoverageObject.find((c) => c.priority === 1)).toBeDefined();
        expect(suggestedNewCoverageObject.find((c) => c.priority === 2)).toBeDefined();
        expect(suggestedNewCoverageObject?.length).toBe(2);
        expect(deactivatedCoverages).toBeDefined();
        expect(deactivatedCoverages?.length).toBe(0);
        expect(coverageUpdates).toBeDefined();
        expect(Object.keys(coverageUpdates).length).toBe(2);
        expect(relatedPersonUpdates).toBeDefined();

        expect(Object.values(relatedPersonUpdates).flatMap((v) => v).length).toBe(0);
        expect(Object.values(coverageUpdates).flatMap((v) => v).length).toBe(4);
      });
      it('should use a new contained RelatedPerson on Coverage when matching data differs between old and new subscriber, but coverage should be reused if it already exists', () => {
        const existingPrimarySubscriber: RelatedPerson = {
          ...primarySubscriber,
          birthDate: '1999-09-09',
        };
        const existingSecondarySubscriber: RelatedPerson = {
          ...secondarySubscriber,
          birthDate: '1999-07-08',
        };
        const existingCoverages = {
          primary,
          primarySubscriber: existingPrimarySubscriber,
          secondary,
          secondarySubscriber: existingSecondarySubscriber,
        };
        const result = resolveCoverageUpdates({ patient: newPatient1, existingCoverages, newCoverages: coverages });
        const { suggestedNewCoverageObject, deactivatedCoverages, coverageUpdates, relatedPersonUpdates } = result;
        expect(suggestedNewCoverageObject).toBeDefined();
        assert(suggestedNewCoverageObject);
        expect(suggestedNewCoverageObject.find((c) => c.priority === 1)).toBeDefined();
        expect(suggestedNewCoverageObject.find((c) => c.priority === 2)).toBeDefined();
        expect(suggestedNewCoverageObject?.length).toBe(2);
        expect(deactivatedCoverages).toBeDefined();
        expect(deactivatedCoverages?.length).toBe(0);
        expect(coverageUpdates).toBeDefined();
        expect(Object.keys(coverageUpdates).length).toBe(2);
        expect(relatedPersonUpdates).toBeDefined();
        expect(Object.values(relatedPersonUpdates).flatMap((v) => v).length).toBe(0);
        expect(Object.values(coverageUpdates).flatMap((v) => v).length).toBe(4);
        const coverageUpdateList = Object.values(coverageUpdates).flatMap((v) => v);
        const coverageUpdate1 = coverageUpdateList[0];
        const coverageUpdate2 = coverageUpdateList[1];
        const coverageUpdate3 = coverageUpdateList[2];
        const coverageUpdate4 = coverageUpdateList[3];
        assert(coverageUpdate1);
        assert(coverageUpdate2);
        assert(coverageUpdate3);
        assert(coverageUpdate4);
        expect(coverageUpdate1.op).toBe('add');
        expect(coverageUpdate1.path).toBe('/contained');
        expect((coverageUpdate1 as any).value).toEqual([expectedPrimaryPolicyHolderFromQR1]);
        expect(coverageUpdate2.op).toBe('replace');
        expect(coverageUpdate2.path).toBe('/subscriber');
        expect((coverageUpdate2 as any).value).toEqual({
          reference: `#${expectedPrimaryPolicyHolderFromQR1.id}`,
        });
        expect(coverageUpdate3.op).toBe('add');
        expect(coverageUpdate3.path).toBe('/contained');
        expect((coverageUpdate3 as any).value).toEqual([expectedSecondaryPolicyHolderFromQR1]);
        expect(coverageUpdate4.op).toBe('replace');
        expect(coverageUpdate4.path).toBe('/subscriber');
        expect((coverageUpdate4 as any).value).toEqual({
          reference: `#${expectedSecondaryPolicyHolderFromQR1.id}`,
        });
        const newPrimaryCoverage = suggestedNewCoverageObject.find((c) => c.priority === 1)?.coverage;
        const newSecondaryCoverage = suggestedNewCoverageObject.find((c) => c.priority === 2)?.coverage;
        assert(newPrimaryCoverage);
        assert(newSecondaryCoverage);
        expect(newPrimaryCoverage?.reference).toBe(`Coverage/${existingCoverages.primary.id}`);
        expect(newSecondaryCoverage.reference).toBe(`Coverage/${existingCoverages.secondary.id}`);
      });
    });
    describe('should generate the right output when comparing Account with existing primary and secondary coverages flip-flopped', () => {
      it('should return no patches when subscribers and coverage match new values exactly, but suggest coverage priority should be correct', () => {
        const existingCoverages = {
          secondary: primary,
          secondarySubscriber: primarySubscriber,
          primary: secondary,
          primarySubscriber: secondarySubscriber,
        };

        const result = resolveCoverageUpdates({ patient: newPatient1, existingCoverages, newCoverages: coverages });
        const { suggestedNewCoverageObject, deactivatedCoverages, coverageUpdates, relatedPersonUpdates } = result;
        expect(suggestedNewCoverageObject).toBeDefined();
        assert(suggestedNewCoverageObject);
        expect(suggestedNewCoverageObject.find((c) => c.priority === 1)).toBeDefined();
        expect(suggestedNewCoverageObject.find((c) => c.priority === 2)).toBeDefined();
        expect(suggestedNewCoverageObject?.length).toBe(2);
        expect(deactivatedCoverages).toBeDefined();
        expect(deactivatedCoverages?.length).toBe(0);
        expect(coverageUpdates).toBeDefined();
        expect(Object.keys(coverageUpdates).length).toBe(0);
        expect(relatedPersonUpdates).toBeDefined();

        // there can be entries with empty arrays here. the important thing is that the length of all actual operations is 0
        expect(Object.values(relatedPersonUpdates).flatMap((v) => v).length).toBe(0);

        const newPrimaryCoverage = suggestedNewCoverageObject.find((c) => c.priority === 1)?.coverage;
        const newSecondaryCoverage = suggestedNewCoverageObject.find((c) => c.priority === 2)?.coverage;
        assert(newPrimaryCoverage);
        assert(newSecondaryCoverage);
        expect(newPrimaryCoverage?.reference).toBe(`Coverage/${existingCoverages.secondary.id}`);
        expect(newSecondaryCoverage.reference).toBe(`Coverage/${existingCoverages.primary.id}`);
      });
      it('should return no patches when subscribers match and existing value has data not found in input', () => {
        const existingPrimarySubscriber: RelatedPerson = {
          ...primarySubscriber,
          telecom: [
            {
              value: 'is_aol_still_cool@aol.com',
              system: 'email',
            },
          ],
        };
        const existingSecondarySubscriber: RelatedPerson = {
          ...secondarySubscriber,
          telecom: [
            {
              value: 'gmailIsAlwaysCoolJustLikeCamelCase@gmail.com',
              system: 'email',
            },
          ],
        };
        const existingCoverages = {
          secondary: primary,
          secondarySubscriber: existingPrimarySubscriber,
          primary: secondary,
          primarySubscriber: existingSecondarySubscriber,
        };
        const result = resolveCoverageUpdates({ patient: newPatient1, existingCoverages, newCoverages: coverages });
        const { suggestedNewCoverageObject, deactivatedCoverages, coverageUpdates, relatedPersonUpdates } = result;
        expect(suggestedNewCoverageObject).toBeDefined();
        assert(suggestedNewCoverageObject);
        expect(suggestedNewCoverageObject.find((c) => c.priority === 1)).toBeDefined();
        expect(suggestedNewCoverageObject.find((c) => c.priority === 2)).toBeDefined();
        expect(suggestedNewCoverageObject?.length).toBe(2);
        expect(deactivatedCoverages).toBeDefined();
        expect(deactivatedCoverages?.length).toBe(0);
        expect(coverageUpdates).toBeDefined();
        expect(Object.keys(coverageUpdates).length).toBe(0);
        expect(relatedPersonUpdates).toBeDefined();
        // there can be entries with empty arrays here. the important thing is that the length of all actual operations is 0
        expect(Object.values(relatedPersonUpdates).flatMap((v) => v).length).toBe(0);

        const newPrimaryCoverage = suggestedNewCoverageObject.find((c) => c.priority === 1)?.coverage;
        const newSecondaryCoverage = suggestedNewCoverageObject.find((c) => c.priority === 2)?.coverage;
        assert(newPrimaryCoverage);
        assert(newSecondaryCoverage);
        expect(newPrimaryCoverage?.reference).toBe(`Coverage/${existingCoverages.secondary.id}`);
        expect(newSecondaryCoverage.reference).toBe(`Coverage/${existingCoverages.primary.id}`);
      });
      it('should return patches when subscribers match and existing value is changed by input', () => {
        const existingPrimarySubscriber: RelatedPerson = {
          ...primarySubscriber,
          relationship: [
            {
              coding: [
                {
                  system: 'http://hl7.org/fhir/ValueSet/relatedperson-relationshiptype',
                  code: 'parent',
                  display: 'Parent',
                },
              ],
            },
          ],
        };
        const existingSecondarySubscriber: RelatedPerson = {
          ...secondarySubscriber,
          relationship: [
            {
              coding: [
                {
                  system: 'http://hl7.org/fhir/ValueSet/relatedperson-relationshiptype',
                  code: 'parent',
                  display: 'Parent',
                },
              ],
            },
          ],
        };
        const existingCoverages = {
          secondary: primary,
          secondarySubscriber: existingPrimarySubscriber,
          primary: secondary,
          primarySubscriber: existingSecondarySubscriber,
        };

        const result = resolveCoverageUpdates({ patient: newPatient1, existingCoverages, newCoverages: coverages });
        const { suggestedNewCoverageObject, deactivatedCoverages, coverageUpdates, relatedPersonUpdates } = result;
        expect(suggestedNewCoverageObject).toBeDefined();
        assert(suggestedNewCoverageObject);
        expect(suggestedNewCoverageObject.find((c) => c.priority === 1)).toBeDefined();
        expect(suggestedNewCoverageObject.find((c) => c.priority === 2)).toBeDefined();
        expect(suggestedNewCoverageObject?.length).toBe(2);
        expect(deactivatedCoverages).toBeDefined();
        expect(deactivatedCoverages?.length).toBe(0);
        expect(coverageUpdates).toBeDefined();
        expect(Object.keys(coverageUpdates).length).toBe(0);
        expect(relatedPersonUpdates).toBeDefined();
        expect(Object.keys(relatedPersonUpdates).length).toBe(2);

        expect(Object.values(relatedPersonUpdates).flatMap((v) => v).length).toBe(2);
        const update1 = Object.values(relatedPersonUpdates)[0]?.[0];
        const update2 = Object.values(relatedPersonUpdates)[1]?.[0];
        assert(update1);
        assert(update2);
        expect(update1.op).toBe('replace');
        expect(update1.path).toBe('/relationship');
        expect((update1 as any).value).toEqual([
          {
            coding: [
              {
                system: 'http://hl7.org/fhir/ValueSet/relatedperson-relationshiptype',
                code: 'child',
                display: 'Child',
              },
            ],
          },
        ]);
        expect(update2.op).toBe('replace');
        expect(update2.path).toBe('/relationship');
        expect((update2 as any).value).toEqual([
          {
            coding: [
              {
                system: 'http://hl7.org/fhir/ValueSet/relatedperson-relationshiptype',
                code: 'child',
                display: 'Child',
              },
            ],
          },
        ]);
        const newPrimaryCoverage = suggestedNewCoverageObject.find((c) => c.priority === 1)?.coverage;
        const newSecondaryCoverage = suggestedNewCoverageObject.find((c) => c.priority === 2)?.coverage;
        assert(newPrimaryCoverage);
        assert(newSecondaryCoverage);
        expect(newPrimaryCoverage?.reference).toBe(`Coverage/${existingCoverages.secondary.id}`);
        expect(newSecondaryCoverage.reference).toBe(`Coverage/${existingCoverages.primary.id}`);
      });
      it('should combine a new address rather than overwriting existing address when a new address is sent in input', () => {
        const existingPrimarySubscriber: RelatedPerson = {
          ...primarySubscriber,
          address: [
            {
              line: ['456 Bluegrass Lane', 'Suite 300'],
              city: 'Lexington',
              state: 'KY',
              postalCode: '40507',
            },
          ],
        };
        const existingSecondarySubscriber: RelatedPerson = {
          ...secondarySubscriber,
          address: [
            {
              line: ['789 Potato Lane', 'Suite 300'],
              city: 'Boise',
              state: 'ID',
              postalCode: '83701',
            },
          ],
        };
        const existingCoverages = {
          secondary: primary,
          secondarySubscriber: existingPrimarySubscriber,
          primary: secondary,
          primarySubscriber: existingSecondarySubscriber,
        };
        const result = resolveCoverageUpdates({ patient: newPatient1, existingCoverages, newCoverages: coverages });
        const { suggestedNewCoverageObject, deactivatedCoverages, coverageUpdates, relatedPersonUpdates } = result;
        expect(suggestedNewCoverageObject).toBeDefined();
        assert(suggestedNewCoverageObject);
        expect(suggestedNewCoverageObject.find((c) => c.priority === 1)).toBeDefined();
        expect(suggestedNewCoverageObject.find((c) => c.priority === 2)).toBeDefined();
        expect(suggestedNewCoverageObject?.length).toBe(2);
        expect(deactivatedCoverages).toBeDefined();
        expect(deactivatedCoverages?.length).toBe(0);
        expect(coverageUpdates).toBeDefined();
        expect(Object.keys(coverageUpdates).length).toBe(0);
        expect(relatedPersonUpdates).toBeDefined();
        expect(Object.values(relatedPersonUpdates).flatMap((v) => v).length).toBe(2);
        const update1 = Object.values(relatedPersonUpdates)[0]?.[0];
        const update2 = Object.values(relatedPersonUpdates)[1]?.[0];
        assert(update1);
        assert(update2);
        expect(update1.op).toBe('replace');
        expect(update1.path).toBe('/address');
        expect((update1 as any).value).toEqual([
          {
            line: ['317 Mustard Street', 'Unit 2'],
            city: 'DeliciousVilla',
            state: 'DE',
            postalCode: '20001',
          },
          {
            line: ['456 Bluegrass Lane', 'Suite 300'],
            city: 'Lexington',
            state: 'KY',
            postalCode: '40507',
          },
        ]);
        expect(update2.op).toBe('replace');
        expect(update2.path).toBe('/address');
        expect((update2 as any).value).toEqual([
          {
            line: ['317 R St NW Unit 2', 'conditional-filter-test-1234'],
            city: 'Washington',
            state: 'DC',
            postalCode: '20001',
          },
          {
            line: ['789 Potato Lane', 'Suite 300'],
            city: 'Boise',
            state: 'ID',
            postalCode: '83701',
          },
        ]);
        const newPrimaryCoverage = suggestedNewCoverageObject.find((c) => c.priority === 1)?.coverage;
        const newSecondaryCoverage = suggestedNewCoverageObject.find((c) => c.priority === 2)?.coverage;
        assert(newPrimaryCoverage);
        assert(newSecondaryCoverage);
        expect(newPrimaryCoverage?.reference).toBe(`Coverage/${existingCoverages.secondary.id}`);
        expect(newSecondaryCoverage.reference).toBe(`Coverage/${existingCoverages.primary.id}`);
      });
      it('should use a new contained RelatedPerson on Coverage when matching data differs between old and new subscriber, but coverage should be reused if it already exists', () => {
        const existingPrimarySubscriber: RelatedPerson = {
          ...primarySubscriber,
          birthDate: '1999-09-09',
        };
        const existingSecondarySubscriber: RelatedPerson = {
          ...secondarySubscriber,
          birthDate: '1999-07-08',
        };
        const existingCoverages = {
          secondary: primary,
          secondarySubscriber: existingPrimarySubscriber,
          primary: secondary,
          primarySubscriber: existingSecondarySubscriber,
        };
        const result = resolveCoverageUpdates({ patient: newPatient1, existingCoverages, newCoverages: coverages });
        const { suggestedNewCoverageObject, deactivatedCoverages, coverageUpdates, relatedPersonUpdates } = result;
        expect(suggestedNewCoverageObject).toBeDefined();
        assert(suggestedNewCoverageObject);
        expect(suggestedNewCoverageObject.find((c) => c.priority === 1)).toBeDefined();
        expect(suggestedNewCoverageObject.find((c) => c.priority === 2)).toBeDefined();
        expect(suggestedNewCoverageObject?.length).toBe(2);
        expect(deactivatedCoverages).toBeDefined();
        expect(deactivatedCoverages?.length).toBe(0);
        expect(coverageUpdates).toBeDefined();
        expect(Object.keys(coverageUpdates).length).toBe(2);
        expect(relatedPersonUpdates).toBeDefined();
        expect(Object.values(relatedPersonUpdates).flatMap((v) => v).length).toBe(0);
        expect(Object.values(coverageUpdates).flatMap((v) => v).length).toBe(4);
        const coverageUpdateList = Object.values(coverageUpdates).flatMap((v) => v);
        const coverageUpdate1 = coverageUpdateList[0];
        const coverageUpdate2 = coverageUpdateList[1];
        const coverageUpdate3 = coverageUpdateList[2];
        const coverageUpdate4 = coverageUpdateList[3];
        assert(coverageUpdate1);
        assert(coverageUpdate2);
        assert(coverageUpdate3);
        assert(coverageUpdate4);
        expect(coverageUpdate1.op).toBe('add');
        expect(coverageUpdate1.path).toBe('/contained');
        expect((coverageUpdate1 as any).value).toEqual([expectedPrimaryPolicyHolderFromQR1]);
        expect(coverageUpdate2.op).toBe('replace');
        expect(coverageUpdate2.path).toBe('/subscriber');
        expect((coverageUpdate2 as any).value).toEqual({
          reference: `#${expectedPrimaryPolicyHolderFromQR1.id}`,
        });
        expect(coverageUpdate3.op).toBe('add');
        expect(coverageUpdate3.path).toBe('/contained');
        expect((coverageUpdate3 as any).value).toEqual([expectedSecondaryPolicyHolderFromQR1]);
        expect(coverageUpdate4.op).toBe('replace');
        expect(coverageUpdate4.path).toBe('/subscriber');
        expect((coverageUpdate4 as any).value).toEqual({
          reference: `#${expectedSecondaryPolicyHolderFromQR1.id}`,
        });
        const newPrimaryCoverage = suggestedNewCoverageObject.find((c) => c.priority === 1)?.coverage;
        const newSecondaryCoverage = suggestedNewCoverageObject.find((c) => c.priority === 2)?.coverage;
        assert(newPrimaryCoverage);
        assert(newSecondaryCoverage);
        expect(newPrimaryCoverage?.reference).toBe(`Coverage/${existingCoverages.secondary.id}`);
        expect(newSecondaryCoverage.reference).toBe(`Coverage/${existingCoverages.primary.id}`);
      });
    });
    describe('and correctly handle the self-pay case', () => {
      it('should deactivate both existing coverages when no coverages are input in the paperwork', () => {
        const existingCoverages = {
          primary,
          primarySubscriber,
          secondary,
          secondarySubscriber,
        };
        const result = resolveCoverageUpdates({ patient: newPatient1, existingCoverages, newCoverages: {} });
        expect(result).toBeDefined();
        assert(result);
        expect(result.deactivatedCoverages).toBeDefined();
        expect(result.deactivatedCoverages?.length).toBe(2);
        expect(result.coverageUpdates).toBeDefined();
        expect(Object.keys(result.coverageUpdates).length).toBe(0);
        expect(result.relatedPersonUpdates).toBeDefined();
        expect(Object.keys(result.relatedPersonUpdates).length).toBe(0);
      });
    });

    describe('should generate the right output when comparing guarantor from questionnaire with existing guarantor', () => {
      it('should make no changes when existing account and new account both use Patient as guarantor', () => {
        const existingGuarantor = {
          party: {
            reference: `Patient/${newPatient1.id}`,
          },
        };
        const result = resolveGuarantor({
          patientId: newPatient1.id!,
          guarantorFromQuestionnaire: { ...accountGuarantor, relationship: 'Self' },
          existingGuarantorResource: newPatient1,
          existingGuarantorReferences: [existingGuarantor],
        });
        expect(result).toBeDefined();
        assert(result);
        const { contained, guarantors } = result;
        expect(contained).toBeUndefined();
        expect(guarantors).toBeDefined();
        expect(guarantors?.length).toBe(1);
        expect(guarantors).toEqual([existingGuarantor]);
      });
      it('should make no changes when existing account guarantor is a persisted RelatedPerson that matches the questionnaire responsible party', () => {
        const existingGuarantorId = uuidV4();
        const existingGuarantorReference = {
          party: {
            reference: `RelatedPerson/${existingGuarantorId}`,
          },
        };
        const existingGuarantorResource = {
          ...expectedAccountGuarantorFromQR1,
          telecom: [
            {
              value: '555-555-5555',
              type: 'phone',
            },
          ],
          id: existingGuarantorId,
        };
        const result = resolveGuarantor({
          patientId: newPatient1.id!,
          guarantorFromQuestionnaire: accountGuarantor,
          existingGuarantorResource: existingGuarantorResource,
          existingGuarantorReferences: [existingGuarantorReference],
        });
        expect(result).toBeDefined();
        assert(result);
        const { contained, guarantors } = result;
        expect(contained).toBeUndefined();
        expect(guarantors).toBeDefined();
        expect(guarantors?.length).toBe(1);
        expect(guarantors).toEqual([existingGuarantorReference]);
      });
      it('should create a new contained RelatedPerson when existing account guarantor is a persisted RelatedPerson that does not match the questionnaire responsible party', () => {
        const existingGuarantorId = uuidV4();
        const existingGuarantorReference = {
          party: {
            reference: `RelatedPerson/${existingGuarantorId}`,
          },
        };
        const existingGuarantorResource = {
          ...expectedAccountGuarantorFromQR1,
          birthDate: '1999-09-09',
          id: existingGuarantorId,
        };

        const timestamp = DateTime.now().toISO();

        const expectedGuarantorArray = [
          {
            party: {
              reference: `#${expectedAccountGuarantorFromQR1.id}`,
              type: 'RelatedPerson',
            },
          },
          {
            party: {
              reference: `RelatedPerson/${existingGuarantorId}`,
            },
            period: { end: timestamp },
          },
        ];

        const result = resolveGuarantor({
          patientId: newPatient1.id!,
          guarantorFromQuestionnaire: accountGuarantor,
          existingGuarantorResource: existingGuarantorResource,
          existingGuarantorReferences: [existingGuarantorReference],
          timestamp,
        });
        expect(result).toBeDefined();
        assert(result);
        const { contained, guarantors } = result;
        expect(contained).toBeDefined();
        expect(guarantors).toBeDefined();
        expect(guarantors?.length).toBe(2);
        expect(guarantors).toEqual(expectedGuarantorArray);
        expect(contained).toEqual([expectedAccountGuarantorFromQR1]);
      });
      it('should create a new contained RelatedPerson when existing account guarantor is a Patient and questionnaire guarantor relationship != "Self"', () => {
        const existingGuarantorReference = {
          party: {
            reference: `Patient/${newPatient1.id}`,
          },
        };

        const timestamp = DateTime.now().toISO();

        const expectedGuarantorArray = [
          {
            party: {
              reference: `#${expectedAccountGuarantorFromQR1.id}`,
              type: 'RelatedPerson',
            },
          },
          {
            party: {
              reference: `Patient/${newPatient1.id}`,
            },
            period: { end: timestamp },
          },
        ];

        const result = resolveGuarantor({
          patientId: newPatient1.id!,
          guarantorFromQuestionnaire: accountGuarantor,
          existingGuarantorResource: newPatient1,
          existingGuarantorReferences: [existingGuarantorReference],
          timestamp,
        });
        expect(result).toBeDefined();
        assert(result);
        const { contained, guarantors } = result;
        expect(contained).toBeDefined();
        expect(guarantors).toBeDefined();
        expect(guarantors?.length).toBe(2);
        expect(guarantors).toEqual(expectedGuarantorArray);
        expect(contained).toEqual([expectedAccountGuarantorFromQR1]);
      });
      it('should use the data from the form for the contained guarantor RP whenever the existing guarantor is also a contained guarantor RP', () => {
        const existingGuarantorReference = {
          party: {
            reference: `#${expectedAccountGuarantorFromQR1.id}`,
            type: 'RelatedPerson',
          },
        };
        const existingGuarantorResource = {
          ...expectedAccountGuarantorFromQR1,
          telecom: [
            {
              value: '555-555-5555',
              type: 'phone',
            },
          ],
        };

        const timestamp = DateTime.now().toISO();

        const expectedGuarantorArray = [
          {
            party: {
              reference: `#${expectedAccountGuarantorFromQR1.id}`,
              type: 'RelatedPerson',
            },
          },
        ];

        const result = resolveGuarantor({
          patientId: newPatient1.id!,
          guarantorFromQuestionnaire: accountGuarantor,
          existingGuarantorResource: existingGuarantorResource,
          existingGuarantorReferences: [existingGuarantorReference],
          existingContained: [existingGuarantorResource],
          timestamp,
          // choke: true,
        });
        expect(result).toBeDefined();
        assert(result);
        const { contained, guarantors } = result;
        expect(contained).toBeDefined();
        expect(guarantors).toBeDefined();
        expect(guarantors?.length).toBe(1);
        expect(guarantors).toEqual(expectedGuarantorArray);
        expect(contained).toEqual([expectedAccountGuarantorFromQR1]);
      });
      it('it should leave period.end untouched when there is a long list of old guarantors', () => {
        const existingGuarantorId = uuidV4();
        const oldExistingGuarantorId1 = uuidV4();
        const oldExistingGuarantorId2 = uuidV4();
        const timestamp = DateTime.now().toISO();
        const timestamp2 = DateTime.now().minus({ years: 1 }).toISO();
        const timestamp3 = DateTime.now().minus({ years: 2, days: 21 }).toISO();
        const existingGuarantorReferences = [
          {
            party: {
              reference: `RelatedPerson/${existingGuarantorId}`,
              type: 'RelatedPerson',
            },
          },
          {
            party: {
              reference: `RelatedPerson/${oldExistingGuarantorId1}`,
              type: 'RelatedPerson',
            },
            period: { end: timestamp2 },
          },
          {
            party: {
              reference: `Patient/${oldExistingGuarantorId2}`,
              type: 'Patient',
            },
            period: { end: timestamp3 },
          },
        ];
        const existingGuarantorResource = {
          ...expectedAccountGuarantorFromQR1,
          birthDate: '1999-09-09',
          id: existingGuarantorId,
        };

        const expectedGuarantorArray = [
          {
            party: {
              reference: `#${expectedAccountGuarantorFromQR1.id}`,
              type: 'RelatedPerson',
            },
          },
          {
            party: {
              reference: `RelatedPerson/${existingGuarantorId}`,
              type: 'RelatedPerson',
            },
            period: { end: timestamp },
          },
          {
            party: {
              reference: `RelatedPerson/${oldExistingGuarantorId1}`,
              type: 'RelatedPerson',
            },
            period: { end: timestamp2 },
          },
          {
            party: {
              reference: `Patient/${oldExistingGuarantorId2}`,
              type: 'Patient',
            },
            period: { end: timestamp3 },
          },
        ];

        const result = resolveGuarantor({
          patientId: newPatient1.id!,
          guarantorFromQuestionnaire: accountGuarantor,
          existingGuarantorResource: existingGuarantorResource,
          existingGuarantorReferences,
          timestamp,
        });
        expect(result).toBeDefined();
        assert(result);
        const { contained, guarantors } = result;
        expect(contained).toBeDefined();
        expect(guarantors).toBeDefined();
        expect(guarantors?.length).toBe(4);
        expect(guarantors).toEqual(expectedGuarantorArray);
        expect(contained).toEqual([expectedAccountGuarantorFromQR1]);
      });
    });
  });
  describe('getAccountOperations', () => {
    const questionnaireResponseItem = questionnaireResponse1.item;
    /*
    these optional params will be specified in each test:

    existingCoverages: { primary?: Coverage; secondary?: Coverage };
    existingGuarantorResource?: RelatedPerson | Patient;
    existingAccount?: Account;
    */
    const patient = { ...newPatient1 };
    it('returns a well formulated post request for the new Account case', () => {
      const result = getAccountOperations({
        patient,
        questionnaireResponseItem,
        organizationResources: organizations1,
        existingCoverages: {
          primary: undefined,
          secondary: undefined,
        },
      });
      expect(result).toBeDefined();
      assert(result);
      const { accountPost: post } = result;
      checkAccountOperations(result, expectedAccount);
      expect(post).toBeDefined();
      expect(post?.resourceType).toBe('Account');
      expect(post?.status).toBe('active');
      expect(post?.type).toBeDefined();
      expect(post?.type?.coding).toBeDefined();
      expect(post?.type?.coding?.length).toBe(1);
      expect(post?.type?.coding?.[0].system).toBe('http://terminology.hl7.org/CodeSystem/account-type');
      expect(post?.type?.coding?.[0].code).toBe('PBILLACCT');
      expect(post?.type?.coding?.[0].display).toBe('patient billing account');
      expect(post?.subject).toBeDefined();
      expect(post?.subject?.[0]?.reference).toBe(`Patient/${patient.id}`);
    });
    it('should return a well formulated post request for new Account and patch operations for Coverage updates', () => {
      const primary: Coverage = {
        resourceType: 'Coverage',
        id: uuidV4(),
        status: 'active',
        beneficiary: { reference: 'Patient/36ef99c2-43fa-40f6-bf9c-d9ea12c2bf61', type: 'Patient' },
        payor: [{ reference: 'Organization/db875d9d-5726-4c45-a689-e11a7bbdf176' }],
        subscriberId: 'FafOneJwgNdkOetWwe6',
        subscriber: { reference: 'RelatedPerson/36ef99c3-43fb-50f4-bf9d-d9ea12c2bf62' },
        order: 1,
        identifier: [
          {
            ...COVERAGE_MEMBER_IDENTIFIER_BASE,
            value: 'FafOneJwgNdkOetWwe6',
            assigner: {
              reference: 'Organization/db875d9d-5726-4c45-a689-e11a7bbdf176',
              display: 'Aetna',
            },
          },
        ],
        relationship: {
          coding: [
            {
              system: 'http://terminology.hl7.org/CodeSystem/subscriber-relationship',
              code: 'child',
              display: 'Child',
            },
          ],
        },
        class: [
          {
            name: 'Aetna',
            type: {
              coding: [
                {
                  code: 'plan',
                  system: 'http://terminology.hl7.org/CodeSystem/coverage-class',
                },
              ],
            },
            value: '60054',
          },
        ],
        type: {
          coding: [
            {
              code: '09',
              system: 'https://fhir.ottehr.com/CodeSystem/candid-plan-type',
            },
            {
              code: 'pay',
              system: 'http://terminology.hl7.org/CodeSystem/coverage-selfpay',
            },
          ],
        },
      };
      const primarySubscriber: RelatedPerson = {
        resourceType: 'RelatedPerson',
        id: uuidV4(),
        name: [
          {
            given: ['Barnabas', 'Thaddeus'],
            family: 'PicklesWorth',
          },
        ],
        birthDate: '1984-02-23',
        gender: 'male',
        patient: { reference: 'Patient/36ef99c2-43fa-40f6-bf9c-d9ea12c2bf61' },
        relationship: [
          {
            coding: [
              {
                system: 'http://hl7.org/fhir/ValueSet/relatedperson-relationshiptype',
                code: 'child',
                display: 'Child',
              },
            ],
          },
        ],
        address: [
          {
            line: ['317 Mustard Street', 'Unit 2'],
            city: 'DeliciousVilla',
            state: 'DE',
            postalCode: '20001',
          },
        ],
      };

      const accountExpectation: Account = {
        ...expectedAccount,
        coverage: [
          {
            coverage: { reference: `Coverage/${primary.id}` },
            priority: 1,
          },
          expectedAccount.coverage![1],
        ],
      };
      const result = getAccountOperations({
        patient,
        questionnaireResponseItem,
        organizationResources: organizations1,
        existingCoverages: {
          primary,
          primarySubscriber,
        },
      });
      expect(result).toBeDefined();
      assert(result);
      const { patch } = result;
      checkAccountOperations(result, accountExpectation);
      expect(patch).toBeDefined();
      assert(patch);
      expect(patch?.length).toBe(1);
      const patchObj = patch?.[0];
      assert(patchObj);
      const patchOperations = (patchObj as any).operations;
      expect(patchOperations.length).toBe(3);
      expect(patchObj.url).toBe(`Coverage/${primary.id}`);
      const [patch1, patch2] = patchOperations;
      assert(patch1 && patch2);
      expect(patch1.op).toBe('add');
      expect(patch1.path).toBe('/contained');
      expect(patch1.value).toEqual([expectedPrimaryPolicyHolderFromQR1]);
      expect(patch2.op).toBe('replace');
      expect(patch2.path).toBe('/subscriber');
      expect(patch2.value).toEqual({
        reference: `#coverageSubscriber`,
      });
    });
    it('should return a well formulated post request for new Account and patch operations to mark deactivated Coverages as inactive', () => {
      const primary: Coverage = {
        resourceType: 'Coverage',
        id: uuidV4(),
        status: 'active',
        beneficiary: { reference: 'Patient/36ef99c2-43fa-40f6-bf9c-d9ea12c2bf61', type: 'Patient' },
        payor: [{ reference: 'Organization/db875d9d-5726-4c45-a689-e11a7bbdf176' }],
        subscriberId: 'FafOneJwgDdkOet1234',
        subscriber: { reference: 'RelatedPerson/36ef99c3-43fb-50f4-bf9d-d9ea12c2bf62' },
        order: 1,
        identifier: [
          {
            ...COVERAGE_MEMBER_IDENTIFIER_BASE,
            value: 'FafOneJwgDdkOet1234',
            assigner: {
              reference: 'Organization/db875d9d-5726-4c45-a689-e11a7bbdf176',
              display: 'Aetna',
            },
          },
        ],
        relationship: {
          coding: [
            {
              system: 'http://terminology.hl7.org/CodeSystem/subscriber-relationship',
              code: 'child',
              display: 'Child',
            },
          ],
        },
        class: [
          {
            name: 'Aetna',
            type: {
              coding: [
                {
                  code: 'plan',
                  system: 'http://terminology.hl7.org/CodeSystem/coverage-class',
                },
              ],
            },
            value: 'Organization/45ae21d2-12a3-4727-b915-896f7dc57dbd',
          },
        ],
        type: {
          coding: [
            {
              code: '09',
              system: 'https://fhir.ottehr.com/CodeSystem/candid-plan-type',
            },
            {
              code: 'pay',
              system: 'http://terminology.hl7.org/CodeSystem/coverage-selfpay',
            },
          ],
        },
      };
      const primarySubscriber: RelatedPerson = {
        resourceType: 'RelatedPerson',
        id: uuidV4(),
        name: [
          {
            given: ['Barnabas', 'Thaddeus'],
            family: 'PicklesWorth',
          },
        ],
        birthDate: '1984-02-26',
        gender: 'male',
        patient: { reference: 'Patient/36ef99c2-43fa-40f6-bf9c-d9ea12c2bf61' },
        relationship: [
          {
            coding: [
              {
                system: 'http://hl7.org/fhir/ValueSet/relatedperson-relationshiptype',
                code: 'child',
                display: 'Child',
              },
            ],
          },
        ],
        address: [
          {
            line: ['317 Mustard Street', 'Unit 2'],
            city: 'DeliciousVilla',
            state: 'DE',
            postalCode: '20001',
          },
        ],
      };
      const result = getAccountOperations({
        patient,
        questionnaireResponseItem,
        organizationResources: organizations1,
        existingCoverages: {
          primary,
          primarySubscriber,
        },
      });
      expect(result).toBeDefined();
      assert(result);
      const { accountPost: post, patch } = result;
      expect(post).toBeDefined();
      expect(post?.resourceType).toBe('Account');
      expect(post?.status).toBe('active');
      checkAccountOperations(result, expectedAccount);
      expect(patch).toBeDefined();
      assert(patch);
      expect(patch?.length).toBe(1);
      const patchObj = patch?.[0];
      assert(patchObj);
      const patchOperations = (patchObj as any).operations;
      expect(patchOperations.length).toBe(1);
      const patch1 = patchOperations[0];
      expect(patch1.op).toBe('replace');
      expect(patch1.path).toBe('/status');
      expect(patch1.value).toBe('cancelled');
    });
    it("should patch an existing Account when one exists and shouldn't post a new one", () => {
      const primary: Coverage = {
        resourceType: 'Coverage',
        id: uuidV4(),
        status: 'active',
        beneficiary: { reference: 'Patient/36ef99c2-43fa-40f6-bf9c-d9ea12c2bf61', type: 'Patient' },
        payor: [{ reference: 'Organization/db875d9d-5726-4c45-a689-e11a7bbdf176' }],
        subscriberId: 'FafOneJwgDdkOet1234',
        subscriber: { reference: 'RelatedPerson/36ef99c3-43fb-50f4-bf9d-d9ea12c2bf62' },
        order: 1,
        identifier: [
          {
            ...COVERAGE_MEMBER_IDENTIFIER_BASE,
            value: 'FafOneJwgDdkOet1234',
            assigner: {
              reference: 'Organization/db875d9d-5726-4c45-a689-e11a7bbdf176',
              display: 'Aetna',
            },
          },
        ],
        relationship: {
          coding: [
            {
              system: 'http://terminology.hl7.org/CodeSystem/subscriber-relationship',
              code: 'child',
              display: 'Child',
            },
          ],
        },
        class: [
          {
            name: 'Aetna',
            type: {
              coding: [
                {
                  code: 'plan',
                  system: 'http://terminology.hl7.org/CodeSystem/coverage-class',
                },
              ],
            },
            value: '46320',
          },
        ],
        type: {
          coding: [
            {
              code: '09',
              system: 'https://fhir.ottehr.com/CodeSystem/candid-plan-type',
            },
            {
              code: 'pay',
              system: 'http://terminology.hl7.org/CodeSystem/coverage-selfpay',
            },
          ],
        },
      };
      const primarySubscriber: RelatedPerson = {
        resourceType: 'RelatedPerson',
        id: uuidV4(),
        name: [
          {
            given: ['Barnabas', 'Thaddeus'],
            family: 'PicklesWorth',
          },
        ],
        birthDate: '1984-02-26',
        gender: 'male',
        patient: { reference: 'Patient/36ef99c2-43fa-40f6-bf9c-d9ea12c2bf61' },
        relationship: [
          {
            coding: [
              {
                system: 'http://hl7.org/fhir/ValueSet/relatedperson-relationshiptype',
                code: 'child',
                display: 'Child',
              },
            ],
          },
        ],
        address: [
          {
            line: ['317 Mustard Street', 'Unit 2'],
            city: 'DeliciousVilla',
            state: 'DE',
            postalCode: '20001',
          },
        ],
      };
      const existingAccount: Account = {
        ...expectedAccount,
        status: 'active',
        id: uuidV4(),
        guarantor: [{ party: { reference: `Patient/${newPatient1.id}`, type: 'Patient' } }],
      };
      existingAccount.contained = undefined;
      const result = getAccountOperations({
        patient,
        questionnaireResponseItem,
        organizationResources: organizations1,
        existingCoverages: {
          primary,
          primarySubscriber,
        },
        existingGuarantorResource: newPatient1,
        existingAccount,
      });
      expect(result).toBeDefined();
      assert(result);
      const { accountPost: post, patch, put } = result;
      checkAccountOperations(result, expectedAccount);
      expect(post).toBeUndefined();
      expect(patch).toBeDefined();
      assert(patch);
      expect(patch.length).toBe(1);
      const accountPut = put.find((p) => p.url === `Account/${existingAccount.id}`);
      const updatedAccount = accountPut?.resource as Account;
      expect(updatedAccount).toBeDefined();
      assert(updatedAccount);
      expect(updatedAccount.contained).toEqual([expectedAccountGuarantorFromQR1]);
      expect(updatedAccount.guarantor).toContainEqual({
        party: {
          reference: `#${expectedAccountGuarantorFromQR1.id}`,
          type: 'RelatedPerson',
        },
      });
    });
  });
  describe('translating query results into input for the account operations', () => {
    const stubSecondaryCoverage: Coverage = {
      resourceType: 'Coverage',
      identifier: [
        {
          ...COVERAGE_MEMBER_IDENTIFIER_BASE, // this holds the 'type'
          value: 'FdfDfdFdfDfh7897',
          assigner: {
            reference: 'Organization/a9bada42-935a-45fa-ba8e-aa3b29478884',
            display: 'United Heartland',
          },
        },
      ],
      // contained: [expectedSecondaryPolicyHolderFromQR1],
      status: 'active',
      beneficiary: { reference: `Patient/${bundle1Patient}`, type: 'Patient' },
      payor: [{ reference: 'Organization/a9bada42-935a-45fa-ba8e-aa3b29478884' }],
      subscriberId: 'FdfDfdFdfDfh7897',
      subscriber: { reference: `RelatedPerson/${bundle1RP1.id}` },
      relationship: {
        coding: [
          {
            system: 'http://terminology.hl7.org/CodeSystem/subscriber-relationship',
            code: 'child',
            display: 'Child',
          },
        ],
      },
      class: [
        {
          name: 'United Heartland',
          type: {
            coding: [
              {
                code: 'plan',
                system: 'http://terminology.hl7.org/CodeSystem/coverage-class',
              },
            ],
          },
          value: 'J1859',
        },
      ],
      type: {
        coding: [
          {
            code: '12',
            system: 'https://fhir.ottehr.com/CodeSystem/candid-plan-type',
          },
          {
            code: 'PPO',
            system: 'http://terminology.hl7.org/CodeSystem/v3-ActCode',
          },
        ],
      },
    };
    it('should have one existing coverage resource for an existing Account case with one primary coverage associated, and all the other stuff should be right too', () => {
      const inputs = getCoverageUpdateResourcesFromUnbundled({ patient: bundle1Patient, resources: bundle1 });
      expect(inputs).toBeDefined();
      expect(inputs.account).toBeDefined();
      expect(inputs.account?.id).toBe(bundle1Account.id);
      expect(inputs.account?.coverage).toBeDefined();
      expect(inputs.account?.coverage?.length).toBe(1);
      expect(inputs.coverages).toBeDefined();
      expect(inputs.coverages?.primary).toBeDefined();
      expect(inputs.coverages?.primary?.id).toBe(bundle1Coverage.id);
      expect(inputs.coverages?.primary?.subscriber).toBeDefined();
      expect(inputs.coverages?.primary?.subscriber?.reference).toBe(`RelatedPerson/${bundle1RP1.id}`);
      expect(inputs.coverages?.primarySubscriber).toBeDefined();
      expect(inputs.coverages?.primarySubscriber?.id).toBe(bundle1RP1.id);
      expect(inputs.coverages.secondary).toBeUndefined();
      expect(inputs.coverages.secondarySubscriber).toBeUndefined();
      expect(inputs.guarantorResource).toBeDefined();
      expect(bundle1.some((r) => r.id === inputs.guarantorResource?.id)).toBe(false);
      expect(`#${inputs.guarantorResource?.id}`).toBe(inputs.account?.guarantor?.[0]?.party?.reference);
      expect(inputs.guarantorResource).toEqual(inputs.account?.contained?.[0]);
    });
    it('it should have primary and no secondary coverage when secondary coverage is added but is not associated with existing account', () => {
      const secondaryCvg = { ...stubSecondaryCoverage, order: 2 };
      const resources = [...bundle1, secondaryCvg];
      const inputs = getCoverageUpdateResourcesFromUnbundled({ patient: bundle1Patient, resources });
      expect(inputs).toBeDefined();
      expect(inputs.account).toBeDefined();
      expect(inputs.account?.id).toBe(bundle1Account.id);
      expect(inputs.account?.coverage).toBeDefined();
      expect(inputs.account?.coverage?.length).toBe(1);
      expect(inputs.coverages).toBeDefined();
      expect(inputs.coverages?.primary).toBeDefined();
      expect(inputs.coverages?.primary?.id).toBe(bundle1Coverage.id);
      expect(inputs.coverages?.primary?.subscriber).toBeDefined();
      expect(inputs.coverages?.primary?.subscriber?.reference).toBe(`RelatedPerson/${bundle1RP1.id}`);
      expect(inputs.coverages?.primarySubscriber).toBeDefined();
      expect(inputs.coverages?.primarySubscriber?.id).toBe(bundle1RP1.id);
      expect(inputs.guarantorResource).toBeDefined();
      expect(bundle1.some((r) => r.id === inputs.guarantorResource?.id)).toBe(false);
      expect(`#${inputs.guarantorResource?.id}`).toBe(inputs.account?.guarantor?.[0]?.party?.reference);
      expect(inputs.guarantorResource).toEqual(inputs.account?.contained?.[0]);

      expect(inputs.coverages.secondary).toBeUndefined();
      expect(inputs.coverages.secondarySubscriber).toBeUndefined();
    });

    it('it should have primary and secondary coverage when secondary coverage is added and there is no existing account', () => {
      const secondaryCvg = { ...stubSecondaryCoverage, order: 2 };
      let resources = [...bundle1, secondaryCvg].filter((r) => r.id !== bundle1Account.id);
      let inputs = getCoverageUpdateResourcesFromUnbundled({ patient: bundle1Patient, resources });
      expect(inputs).toBeDefined();
      expect(inputs.coverages).toBeDefined();
      expect(inputs.coverages?.primary).toBeDefined();
      expect(inputs.coverages?.primary?.id).toBe(bundle1Coverage.id);
      expect(inputs.coverages?.primary?.subscriber).toBeDefined();
      expect(inputs.coverages?.primary?.subscriber?.reference).toBe(`RelatedPerson/${bundle1RP1.id}`);
      expect(inputs.coverages?.primarySubscriber).toBeDefined();
      expect(inputs.coverages?.primarySubscriber?.id).toBe(bundle1RP1.id);

      expect(inputs.coverages.secondary).toBeDefined();
      expect(inputs.coverages.secondarySubscriber).toBeDefined();

      // the same result basic result should obtain with primary/secondary flipped if the order is flipped on the Coverage resources

      resources = resources.map((r) => {
        const asAny = r as any;
        if (asAny.order !== undefined && asAny.resourceType === 'Coverage') {
          return {
            ...asAny,
            order: asAny.order === 2 ? 1 : 2,
          };
        }
        return asAny;
      });
      inputs = getCoverageUpdateResourcesFromUnbundled({ patient: bundle1Patient, resources });
      expect(inputs).toBeDefined();
      expect(inputs.coverages).toBeDefined();
      expect(inputs.coverages?.primary).toBeDefined();
      expect(inputs.coverages?.primary?.id).toBe(secondaryCvg.id);
      expect(inputs.coverages?.primary?.subscriber).toBeDefined();
      expect(inputs.coverages?.primary?.subscriber?.reference).toBe(`RelatedPerson/${bundle1RP1.id}`);
      expect(inputs.coverages?.primarySubscriber).toBeDefined();
      expect(inputs.coverages?.primarySubscriber?.id).toBe(bundle1RP1.id);

      expect(inputs.coverages.secondary).toBeDefined();
      expect(inputs.coverages.secondarySubscriber).toBeDefined();
    });
    it('it should have primary and secondary coverage when secondary coverage is added and there is no existing account and secondary coverage has a contained RP', () => {
      const secondaryCvg = {
        ...stubSecondaryCoverage,
        subscriber: { reference: `#${expectedSecondaryPolicyHolderFromQR1.id}` },
        contained: [expectedSecondaryPolicyHolderFromQR1],
        order: 2,
      };
      let resources = [...bundle1, secondaryCvg].filter((r) => r.id !== bundle1Account.id);
      let inputs = getCoverageUpdateResourcesFromUnbundled({ patient: bundle1Patient, resources });
      expect(inputs).toBeDefined();
      expect(inputs.coverages).toBeDefined();
      expect(inputs.coverages?.primary).toBeDefined();
      expect(inputs.coverages?.primary?.id).toBe(bundle1Coverage.id);
      expect(inputs.coverages?.primary?.subscriber).toBeDefined();
      expect(inputs.coverages?.primary?.subscriber?.reference).toBe(`RelatedPerson/${bundle1RP1.id}`);
      expect(inputs.coverages?.primarySubscriber).toBeDefined();
      expect(inputs.coverages?.primarySubscriber?.id).toBe(bundle1RP1.id);

      expect(inputs.coverages.secondary).toBeDefined();
      expect(inputs.coverages.secondarySubscriber).toBeDefined();

      // the same result basic result should obtain with primary/secondary flipped if the order is flipped on the Coverage resources

      resources = resources.map((r) => {
        const asAny = r as any;
        if (asAny.order !== undefined && asAny.resourceType === 'Coverage') {
          return {
            ...asAny,
            order: asAny.order === 2 ? 1 : 2,
          };
        }
        return asAny;
      });
      inputs = getCoverageUpdateResourcesFromUnbundled({ patient: bundle1Patient, resources });
      expect(inputs).toBeDefined();
      expect(inputs.coverages).toBeDefined();
      expect(inputs.coverages?.primary).toBeDefined();
      expect(inputs.coverages?.primary?.id).toBe(secondaryCvg.id);
      expect(inputs.coverages?.primary?.subscriber).toBeDefined();
      expect(inputs.coverages?.primary?.subscriber?.reference).toBe(`#${expectedSecondaryPolicyHolderFromQR1.id}`);
      expect(inputs.coverages?.primarySubscriber).toBeDefined();
      expect(inputs.coverages?.primarySubscriber?.id).toBe(expectedSecondaryPolicyHolderFromQR1.id);

      expect(inputs.coverages.secondary).toBeDefined();
      expect(inputs.coverages.secondarySubscriber).toBeDefined();
    });
  });
});

const checkAccountOperations = (accountOps: GetAccountOperationsOutput, expectedAccount: Account): void => {
  const adjustExpectedAccount = (account: Account, coveragePosts: BatchInputPostRequest<Coverage>[]): Account => {
    const adjustedAccount = { ...account };
    let idx = 0;
    adjustedAccount.coverage = adjustedAccount.coverage?.map((coverage) => {
      const base = { ...coverage };
      if (base.coverage.reference && !base.coverage.reference.startsWith('Coverage/')) {
        base.coverage.reference = coveragePosts[idx]?.fullUrl;
        idx += 1;
      }
      return base;
    });
    return adjustedAccount;
  };

  expect(accountOps).toBeDefined();
  assert(accountOps);
  const { accountPost: post, coveragePosts, put } = accountOps;

  if (post) {
    expect(post?.resourceType).toBe('Account');
    expect(post?.status).toBe('active');
    const adjustedAccount = adjustExpectedAccount(expectedAccount, coveragePosts);
    expect(post).toEqual(adjustedAccount);
    coveragePosts?.forEach((coveragePost) => {
      const someMatch = post.coverage?.some((c) => c.coverage.reference === coveragePost.fullUrl);
      expect(someMatch).toBe(true);
    });
  } else {
    if (coveragePosts.length) {
      coveragePosts?.forEach((coveragePost) => {
        const accountPut = put.find((p) => p.url.startsWith('Account/'));
        expect(accountPut).toBeDefined();
        const updatedAccount = accountPut?.resource as Account;
        expect(updatedAccount).toBeDefined();
        assert(updatedAccount);
        const someMatch = updatedAccount.coverage?.some((c: any) => c.coverage.reference === coveragePost.fullUrl);
        expect(someMatch).toBe(true);
      });
    }
  }
};

// supporting resources

const newPatient1: Patient = {
  id: '36ef99c2-43fa-40f6-bf9c-d9ea12c2bf61',
  meta: {
    versionId: 'df82db58-cd5b-4585-86cd-d59dcd7ffab9',
    lastUpdated: '2025-02-21T21:41:16.238Z',
  },
  name: [
    {
      given: ['John', 'Wesley'],
      family: 'Harding',
    },
  ],
  active: true,
  gender: 'male',
  telecom: [
    {
      value: 'ibenham+jwh@masslight.com',
      system: 'email',
    },
  ],
  birthDate: '1984-06-12',
  resourceType: 'Patient',
};
const questionnaireResponse1: QuestionnaireResponse = {
  resourceType: 'QuestionnaireResponse',
  questionnaire: `${InPersonQuestionnaire.url}|${InPersonQuestionnaire.version}`,
  status: 'completed',
  item: [
    {
      linkId: 'contact-information-page',
      item: [
        {
          linkId: 'patient-first-name',
          answer: [
            {
              valueString: 'John',
            },
          ],
        },
        {
          linkId: 'patient-last-name',
          answer: [
            {
              valueString: 'Harding',
            },
          ],
        },
        {
          linkId: 'patient-birthdate',
          answer: [
            {
              valueString: '1984-06-12',
            },
          ],
        },
        {
          linkId: 'patient-birth-sex',
          answer: [
            {
              valueString: 'Male',
            },
          ],
        },
        {
          linkId: 'patient-street-address',
          answer: [
            {
              valueString: '123 Main St',
            },
          ],
        },
        {
          linkId: 'patient-street-address-2',
          answer: [
            {
              valueString: 'Apt 4B',
            },
          ],
        },
        {
          linkId: 'patient-city',
          answer: [
            {
              valueString: 'Springfield',
            },
          ],
        },
        {
          linkId: 'patient-state',
          answer: [
            {
              valueString: 'IL',
            },
          ],
        },
        {
          linkId: 'patient-zip',
          answer: [
            {
              valueString: '62701',
            },
          ],
        },
        {
          linkId: 'patient-will-be-18',
          answer: [
            {
              valueBoolean: true,
            },
          ],
        },
        {
          linkId: 'is-new-qrs-patient',
          answer: [
            {
              valueBoolean: true,
            },
          ],
        },
        {
          linkId: 'patient-email',
          answer: [
            {
              valueString: 'ibenham+jwh@masslight.com',
            },
          ],
        },
        {
          linkId: 'patient-number',
          answer: [
            {
              valueString: '(313) 482-5424',
            },
          ],
        },
        {
          linkId: 'mobile-opt-in',
        },
        {
          linkId: 'patient-birth-sex-missing',
        },
        {
          linkId: 'patient-contact-additional-caption',
        },
      ],
    },
    {
      linkId: 'patient-details-page',
      item: [
        {
          linkId: 'patient-ethnicity',
          answer: [
            {
              valueString: 'Not Hispanic or Latino',
            },
          ],
        },
        {
          linkId: 'patient-race',
          answer: [
            {
              valueString: 'White',
            },
          ],
        },
        {
          linkId: 'patient-pronouns',
          answer: [
            {
              valueString: 'He/Him',
            },
          ],
        },
        {
          linkId: 'patient-pronouns-custom',
        },
        {
          linkId: 'patient-details-additional-text',
        },
        {
          linkId: 'patient-point-of-discovery',
          answer: [
            {
              valueString: 'Internet Search',
            },
          ],
        },
        {
          linkId: 'preferred-language',
          answer: [
            {
              valueString: 'English',
            },
          ],
        },
      ],
    },
    {
      linkId: 'primary-care-physician-page',
      item: [
        {
          linkId: 'pcp-name',
          answer: [
            {
              valueString: 'Dr. Smith',
            },
          ],
        },
        {
          linkId: 'pcp-phone',
          answer: [
            {
              valueString: '(555) 123-4567',
            },
          ],
        },
        {
          linkId: 'pcp-fax',
          answer: [
            {
              valueString: '(555) 765-4321',
            },
          ],
        },
        {
          linkId: 'pcp-address',
          answer: [
            {
              valueString: '456 Elm St, Springfield, IL 62701',
            },
          ],
        },
        {
          linkId: 'pcp-email',
          answer: [
            {
              valueString: 'dr.smith@example.com',
            },
          ],
        },
      ],
    },
    {
      linkId: 'payment-option-page',
      item: [
        {
          linkId: 'payment-option',
          answer: [
            {
              valueString: 'I have insurance',
            },
          ],
        },
        {
          linkId: 'card-payment-data',
        },
        {
          linkId: 'insurance-carrier',
          answer: [
            {
              valueReference: {
                reference: 'Organization/db875d9d-5726-4c45-a689-e11a7bbdf176',
                display: 'Aetna',
              },
            },
          ],
        },
        {
          linkId: 'insurance-plan-type',
          answer: [{ valueString: '09' }],
        },
        {
          linkId: 'insurance-member-id',
          answer: [
            {
              valueString: 'FafOneJwgNdkOetWwe6',
            },
          ],
        },
        {
          linkId: 'policy-holder-first-name',
          answer: [
            {
              valueString: 'Barnabas',
            },
          ],
        },
        {
          linkId: 'policy-holder-middle-name',
          answer: [
            {
              valueString: 'Thaddeus',
            },
          ],
        },
        {
          linkId: 'policy-holder-last-name',
          answer: [
            {
              valueString: 'PicklesWorth',
            },
          ],
        },
        {
          linkId: 'policy-holder-date-of-birth',
          answer: [
            {
              valueString: '1982-02-23',
            },
          ],
        },
        {
          linkId: 'policy-holder-birth-sex',
          answer: [
            {
              valueString: 'Male',
            },
          ],
        },
        {
          linkId: 'policy-holder-address-as-patient',
        },
        {
          linkId: 'policy-holder-address',
          answer: [
            {
              valueString: '317 Mustard Street',
            },
          ],
        },
        {
          linkId: 'policy-holder-address-additional-line',
          answer: [
            {
              valueString: 'Unit 2',
            },
          ],
        },
        {
          linkId: 'policy-holder-city',
          answer: [
            {
              valueString: 'DeliciousVilla',
            },
          ],
        },
        {
          linkId: 'policy-holder-state',
          answer: [
            {
              valueString: 'DE',
            },
          ],
        },
        {
          linkId: 'policy-holder-zip',
          answer: [
            {
              valueString: '20001',
            },
          ],
        },
        {
          linkId: 'patient-relationship-to-insured',
          answer: [
            {
              valueString: 'Child',
            },
          ],
        },
        {
          linkId: 'insurance-additional-information',
          answer: [
            {
              valueString: 'Additional info to primary insurance',
            },
          ],
        },
        {
          linkId: 'insurance-card-front',
          answer: [
            {
              valueAttachment: {
                url: 'https://project-api.zapehr.com/v1/z3/0ba6d7a5-a5a6-4c16-a6d9-ce91f300acb4-insurance-cards/099639e6-c89c-4bad-becf-ce15ce010f21/2025-02-23-1740344290487-insurance-card-front.png',
                title: 'insurance-card-front',
                creation: '2025-02-23T15:58:10.979-05:00',
                contentType: 'image/png',
              },
            },
          ],
        },
        {
          linkId: 'insurance-card-back',
          answer: [
            {
              valueAttachment: {
                url: 'https://project-api.zapehr.com/v1/z3/0ba6d7a5-a5a6-4c16-a6d9-ce91f300acb4-insurance-cards/099639e6-c89c-4bad-becf-ce15ce010f21/2025-02-23-1740344301743-insurance-card-back.png',
                title: 'insurance-card-back',
                creation: '2025-02-23T15:58:22.405-05:00',
                contentType: 'image/png',
              },
            },
          ],
        },
        {
          linkId: 'insurance-eligibility-verification-status',
          answer: [
            {
              valueString: 'eligibility-confirmed',
            },
            {
              valueString: 'eligibility-check-not-supported',
            },
          ],
        },
        {
          linkId: 'display-secondary-insurance',
          answer: [
            {
              valueBoolean: true,
            },
          ],
        },
        {
          item: [
            {
              linkId: 'insurance-carrier-2',
              answer: [
                {
                  valueReference: {
                    reference: 'Organization/a9bada42-935a-45fa-ba8e-aa3b29478884',
                    display: 'United Heartland',
                  },
                },
              ],
            },
            {
              linkId: 'insurance-plan-type-2',
              answer: [{ valueString: '12' }],
            },
            {
              linkId: 'insurance-member-id-2',
              answer: [
                {
                  valueString: 'FdfDfdFdfDfh7897',
                },
              ],
            },
            {
              linkId: 'policy-holder-first-name-2',
              answer: [
                {
                  valueString: 'Jennifer',
                },
              ],
            },
            {
              linkId: 'policy-holder-middle-name-2',
              answer: [
                {
                  valueString: 'Celeste',
                },
              ],
            },
            {
              linkId: 'policy-holder-last-name-2',
              answer: [
                {
                  valueString: 'PicklesWorth',
                },
              ],
            },
            {
              linkId: 'policy-holder-date-of-birth-2',
              answer: [
                {
                  valueString: '1983-02-23',
                },
              ],
            },
            {
              linkId: 'policy-holder-birth-sex-2',
              answer: [
                {
                  valueString: 'Female',
                },
              ],
            },
            {
              linkId: 'policy-holder-address-as-patient-2',
              answer: [
                {
                  valueBoolean: true,
                },
              ],
            },
            {
              linkId: 'policy-holder-address-2',
              answer: [
                {
                  valueString: '317 R St NW Unit 2',
                },
              ],
            },
            {
              linkId: 'policy-holder-address-additional-line-2',
              answer: [
                {
                  valueString: 'conditional-filter-test-1234',
                },
              ],
            },
            {
              linkId: 'policy-holder-city-2',
              answer: [
                {
                  valueString: 'Washington',
                },
              ],
            },
            {
              linkId: 'policy-holder-state-2',
              answer: [
                {
                  valueString: 'DC',
                },
              ],
            },
            {
              linkId: 'policy-holder-zip-2',
              answer: [
                {
                  valueString: '20001',
                },
              ],
            },
            {
              linkId: 'patient-relationship-to-insured-2',
              answer: [
                {
                  valueString: 'Child',
                },
              ],
            },
            {
              linkId: 'insurance-additional-information-2',
              answer: [
                {
                  valueString: 'Additional info to secondary insurance',
                },
              ],
            },
            {
              linkId: 'insurance-card-front-2',
            },
            {
              linkId: 'insurance-card-back-2',
            },
          ],
          linkId: 'secondary-insurance',
        },
      ],
    },
    {
      linkId: 'responsible-party-page',
      item: [
        {
          linkId: 'responsible-party-first-name',
          answer: [
            {
              valueString: 'Jane',
            },
          ],
        },
        {
          linkId: 'responsible-party-last-name',
          answer: [
            {
              valueString: 'Doe',
            },
          ],
        },
        {
          linkId: 'responsible-party-birth-sex',
          answer: [
            {
              valueString: 'Female',
            },
          ],
        },
        {
          linkId: 'responsible-party-date-of-birth',
          answer: [
            {
              valueString: '1983-02-23',
            },
          ],
        },
        {
          linkId: 'responsible-party-relationship',
          answer: [
            {
              valueString: 'Parent',
            },
          ],
        },
        {
          linkId: 'responsible-party-address',
          answer: [
            {
              valueString: '123 test lane',
            },
          ],
        },
        {
          linkId: 'responsible-party-address-2',
        },
        {
          linkId: 'responsible-party-city',
          answer: [
            {
              valueString: 'fakePlace',
            },
          ],
        },
        {
          linkId: 'responsible-party-state',
          answer: [
            {
              valueString: 'NY',
            },
          ],
        },
        {
          linkId: 'responsible-party-zip',
          answer: [
            {
              valueString: '11111',
            },
          ],
        },
        {
          linkId: 'responsible-party-number',
          answer: [
            {
              valueString: '(989) 555-6543',
            },
          ],
        },
        {
          linkId: 'responsible-party-email',
          answer: [
            {
              valueString: 'rowdyroddypiper@hotmail.com',
            },
          ],
        },
      ],
    },
    {
      linkId: 'photo-id-page',
    },
    {
      linkId: 'consent-forms-page',
    },
  ],
};
/*
const insurancePlans1: InsurancePlan[] = [
  {
    resourceType: 'InsurancePlan',
    name: 'United Heartland',
    meta: {
      tag: [
        {
          code: INSURANCE_PLAN_PAYER_META_TAG_CODE,
        },
      ],
      versionId: 'dd91938c-7dac-4713-80bf-d813e4e798e5',
      lastUpdated: '2024-12-12T10:02:42.725Z',
    },
    ownedBy: {
      reference: 'Organization/a9bada42-935a-45fa-ba8e-aa3b29478884',
    },
    status: 'active',
    extension: [
      {
        url: INSURANCE_REQ_EXTENSION_URL,
        extension: [
          {
            url: 'requiresSubscriberId',
            valueBoolean: true,
          },
          {
            url: 'requiresSubscriberName',
            valueBoolean: false,
          },
          {
            url: 'requiresRelationshipToSubscriber',
            valueBoolean: true,
          },
          {
            url: 'requiresInsuranceName',
            valueBoolean: true,
          },
          {
            url: 'requiresInsuranceCardImage',
            valueBoolean: true,
          },
          {
            url: 'requiresSubscriberDOB',
            valueBoolean: false,
          },
          {
            url: 'requiresFacilityNPI',
            valueBoolean: false,
          },
          {
            url: 'requiresStateUID',
            valueBoolean: false,
          },
          {
            url: 'enabledEligibilityCheck',
            valueBoolean: true,
          },
        ],
      },
    ],
    id: '217badd9-ded4-4efa-91b9-10ab7cdcb8b8',
  },
  {
    resourceType: 'InsurancePlan',
    name: 'Aetna',
    meta: {
      tag: [
        {
          code: INSURANCE_PLAN_PAYER_META_TAG_CODE,
        },
      ],
      versionId: 'b8833d6b-9530-4db2-af23-ed18ede74c56',
      lastUpdated: '2024-12-12T10:01:13.104Z',
    },
    ownedBy: {
      reference: 'Organization/db875d9d-5726-4c45-a689-e11a7bbdf176',
    },
    status: 'active',
    extension: [
      {
        url: INSURANCE_REQ_EXTENSION_URL,
        extension: [
          {
            url: 'requiresSubscriberId',
            valueBoolean: true,
          },
          {
            url: 'requiresSubscriberName',
            valueBoolean: false,
          },
          {
            url: 'requiresRelationshipToSubscriber',
            valueBoolean: true,
          },
          {
            url: 'requiresInsuranceName',
            valueBoolean: true,
          },
          {
            url: 'requiresInsuranceCardImage',
            valueBoolean: true,
          },
          {
            url: 'requiresSubscriberDOB',
            valueBoolean: false,
          },
          {
            url: 'requiresFacilityNPI',
            valueBoolean: false,
          },
          {
            url: 'requiresStateUID',
            valueBoolean: false,
          },
          {
            url: 'enabledEligibilityCheck',
            valueBoolean: true,
          },
        ],
      },
    ],
    id: '45ae21d2-12a3-4727-b915-896f7dc57dbd',
  },
];
*/

const organizations1: Organization[] = [
  {
    resourceType: 'Organization',
    active: true,
    name: 'United Heartland',
    type: [
      {
        coding: [
          {
            system: `${ORG_TYPE_CODE_SYSTEM}`,
            code: ORG_TYPE_PAYER_CODE,
          },
        ],
      },
    ],
    identifier: [
      {
        type: {
          coding: [
            {
              code: 'XX',
              system: 'http://terminology.hl7.org/CodeSystem/v2-0203',
            },
          ],
        },
        value: 'J1859',
      },
    ],
    extension: [
      {
        url: 'https://fhir.zapehr.com/r4/StructureDefinitions/eligibility',
        valueString: 'no',
      },
      {
        url: 'https://fhir.zapehr.com/r4/StructureDefinitions/era',
        valueString: 'enrollment',
      },
      {
        url: 'https://fhir.zapehr.com/r4/StructureDefinitions/payer-type',
        // cSpell:disable-next workerscomp
        valueString: 'workerscomp',
      },
    ],
    id: 'a9bada42-935a-45fa-ba8e-aa3b29478884',
    meta: {
      versionId: 'adc6c2ad-26e6-4ca1-b053-b0f4bf60ae04',
      lastUpdated: '2024-12-12T10:02:42.483Z',
    },
  },
  {
    resourceType: 'Organization',
    active: true,
    name: 'Aetna',
    type: [
      {
        coding: [
          {
            system: `${ORG_TYPE_CODE_SYSTEM}`,
            code: ORG_TYPE_PAYER_CODE,
          },
        ],
      },
    ],
    identifier: [
      {
        type: {
          coding: [
            {
              code: 'XX',
              system: 'http://terminology.hl7.org/CodeSystem/v2-0203',
            },
          ],
        },
        value: '60054',
      },
    ],
    extension: [
      {
        url: 'https://fhir.zapehr.com/r4/StructureDefinitions/eligibility',
        valueString: 'yes',
      },
      {
        url: 'https://fhir.zapehr.com/r4/StructureDefinitions/era',
        valueString: 'enrollment',
      },
      {
        url: 'https://fhir.zapehr.com/r4/StructureDefinitions/payer-type',
        valueString: 'commercial',
      },
    ],
    id: 'db875d9d-5726-4c45-a689-e11a7bbdf176',
    meta: {
      versionId: '7bd10109-093f-413a-978d-d97d146ddc95',
      lastUpdated: '2024-12-12T10:01:12.820Z',
    },
  },
];

// Resource bundles

const bundle1Patient: Patient = {
  id: '36ef99c2-43fa-40f6-bf9c-d9ea12c2bf61',
  meta: {
    versionId: 'df82db58-cd5b-4585-86cd-d59dcd7ffab9',
    lastUpdated: '2025-02-21T21:41:16.238Z',
  },
  name: [
    {
      given: ['John', 'Wesley'],
      family: 'Harding',
    },
  ],
  active: true,
  gender: 'male',
  telecom: [
    {
      value: 'ibenham+jwh@masslight.com',
      system: 'email',
    },
  ],
  birthDate: '1984-06-12',
  resourceType: 'Patient',
};

const bundle1Account: Account = {
  id: '3d6c331b-ed16-40ec-a7ab-9935c7699f09',
  resourceType: 'Account',
  status: 'active',
  contained: [
    {
      resourceType: 'RelatedPerson',
      id: 'accountGuarantorId',
      name: [
        {
          given: ['Jane'],
          family: 'Doe',
        },
      ],
      birthDate: '1983-02-23',
      gender: 'female',
      patient: {
        reference: 'Patient/36ef99c2-43fa-40f6-bf9c-d9ea12c2bf61',
      },
      relationship: [
        {
          coding: [
            {
              system: 'http://hl7.org/fhir/ValueSet/relatedperson-relationshiptype',
              code: 'parent',
              display: 'Parent',
            },
          ],
        },
      ],
    },
  ],
  type: {
    coding: [
      {
        system: 'http://terminology.hl7.org/CodeSystem/account-type',
        code: 'PBILLACCT',
        display: 'patient billing account',
      },
    ],
  },
  subject: [
    {
      type: 'Patient',
      reference: 'Patient/36ef99c2-43fa-40f6-bf9c-d9ea12c2bf61',
    },
  ],
  guarantor: [
    {
      party: {
        reference: '#accountGuarantorId',
      },
    },
  ],
  coverage: [
    {
      coverage: {
        type: 'Coverage',
        reference: 'Coverage/4a3d4bd6-6c1a-422a-a26f-71b967f3b00c',
      },
      priority: 1,
    },
  ],
  meta: {
    versionId: '3728b10d-4f4d-4401-9be4-f4f7f43aa488',
    lastUpdated: '2025-03-01T03:03:27.796Z',
  },
};

const bundle1RP1: RelatedPerson = {
  id: '90ad77cd-ff76-426a-951a-b35f5ef8b302',
  meta: {
    versionId: '144b3d41-b149-49af-875a-998335101384',
    lastUpdated: '2025-02-21T21:41:19.721Z',
  },
  patient: {
    reference: 'Patient/36ef99c2-43fa-40f6-bf9c-d9ea12c2bf61',
  },
  telecom: [
    {
      value: '+13134825424',
      system: 'phone',
    },
    {
      value: '+13134825424',
      system: 'sms',
    },
  ],
  relationship: [
    {
      coding: [
        {
          code: 'user-relatedperson',
          system: 'https://fhir.zapehr.com/r4/StructureDefinitions/relationship',
        },
      ],
    },
  ],
  resourceType: 'RelatedPerson',
};
const bundle1RP2: RelatedPerson = {
  id: '90ad77cd-ff76-426a-951a-b35f5ef8b302',
  meta: {
    versionId: '144b3d41-b149-49af-875a-998335101384',
    lastUpdated: '2025-02-21T21:41:19.721Z',
  },
  patient: {
    reference: 'Patient/36ef99c2-43fa-40f6-bf9c-d9ea12c2bf61',
  },
  telecom: [
    {
      value: '+13134825424',
      system: 'phone',
    },
    {
      value: '+13134825424',
      system: 'sms',
    },
  ],
  relationship: [
    {
      coding: [
        {
          code: 'user-relatedperson',
          system: 'https://fhir.zapehr.com/r4/StructureDefinitions/relationship',
        },
      ],
    },
  ],
  resourceType: 'RelatedPerson',
};

const bundle1Coverage: Coverage = {
  id: '4a3d4bd6-6c1a-422a-a26f-71b967f3b00c',
  resourceType: 'Coverage',
  status: 'active',
  type: {
    coding: [
      {
        code: '09',
        system: 'https://fhir.ottehr.com/CodeSystem/candid-plan-type',
      },
      {
        code: 'pay',
        system: 'http://terminology.hl7.org/CodeSystem/coverage-selfpay',
      },
    ],
  },
  order: 1,
  subscriber: {
    type: 'RelatedPerson',
    reference: 'RelatedPerson/90ad77cd-ff76-426a-951a-b35f5ef8b302',
  },
  subscriberId: 'FafOneJwgNdkOetWwe6',
  beneficiary: {
    type: 'Patient',
    reference: 'Patient/36ef99c2-43fa-40f6-bf9c-d9ea12c2bf61',
  },
  relationship: {
    coding: [
      {
        system: 'http://terminology.hl7.org/CodeSystem/subscriber-relationship',
        code: 'child',
        display: 'Child',
      },
    ],
  },
  payor: [
    {
      type: 'Organization',
      reference: 'Organization/a9bada42-935a-45fa-ba8e-aa3b29478884',
    },
  ],
  meta: {
    versionId: '4ed8910a-c056-450d-ad5d-ad5f477645a3',
    lastUpdated: '2025-03-01T02:46:02.698Z',
  },
};

const bundle1: (Account | RelatedPerson | Patient | Coverage)[] = [
  bundle1Account,
  bundle1RP1,
  bundle1RP2,
  bundle1Patient,
  bundle1Coverage,
];
