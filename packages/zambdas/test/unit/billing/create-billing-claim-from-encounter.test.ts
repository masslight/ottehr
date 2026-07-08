import Oystehr, { BatchInputPostRequest } from '@oystehr/sdk';
import {
  Account,
  Appointment,
  Basic,
  ChargeItemDefinition,
  Condition,
  Coverage,
  Encounter,
  Location,
  Organization,
  Patient,
  Person,
  Practitioner,
  Procedure,
  RelatedPerson,
} from 'fhir/r4b';
import {
  ACCOUNT_TYPE_CODE_SYSTEM,
  APIError,
  AR_STAGE,
  BILLING_RESOURCE_TAG,
  CANDID_PLAN_TYPE_SYSTEM,
  CHARGE_ITEM_DEFINITION_DEFAULT_SYSTEM,
  CLAIM_STATUS_TAG_SYSTEMS,
  CODE_SYSTEM_CLAIM_TYPE,
  CODE_SYSTEM_CLAIM_TYPE_CODES,
  CODE_SYSTEM_CMS_PLACE_OF_SERVICE,
  CODE_SYSTEM_CPT,
  CODE_SYSTEM_CPT_MODIFIER,
  CODE_SYSTEM_HL7_HCPCS,
  CODE_SYSTEM_ICD_10,
  CODE_SYSTEM_PROCESS_PRIORITY,
  CODE_SYSTEM_SERVICE_CATEGORY_CODES,
  CODE_SYSTEM_SERVICE_CATEGORY_TAG_SYSTEM,
  CPT_CODE_SYSTEM,
  ENCOUNTER_PAYMENT_VARIANT_EXTENSION_URL,
  EXTENSION_CLAIM_INSURANCE_TYPE,
  EXTENSION_URL_CPT_MODIFIER,
  FHIR_IDENTIFIER_NPI,
  FHIR_RESOURCE_NOT_FOUND,
  getDefaultClaimSubmissionExtensions,
  INVALID_INPUT_ERROR,
  MISSING_REQUEST_BODY,
  MISSING_REQUEST_SECRETS,
  PARTICIPATION_CODE_SYSTEM,
  PaymentVariant,
  SERVICE_CATEGORY_SYSTEM,
} from 'utils';
import { ottehrIdentifierSystem } from 'utils/lib/fhir/systemUrls';
import { Mock, vi } from 'vitest';
import {
  complexValidation,
  ComplexValidationOutput,
  copyAccount,
  copyCoverageAndSubscriber,
  copyCoverageAndSubscriberForAccount,
  getClaimCoveragesForEncounter,
  performEffect,
} from '../../../src/billing/create-billing-claim-from-encounter/handler';
import { validateRequestParameters } from '../../../src/billing/create-billing-claim-from-encounter/validateRequestParameters';
import {
  AUTO_ACCIDENT_TAG_DESCRIPTION,
  AUTO_ACCIDENT_TAG_NAME,
  buildNoCoverageStub,
  CLAIM_TAG_SYSTEM,
  CURRENT_STATUS_TAG_SYSTEM,
  TAG_CODE_SYSTEM,
  TAG_DESCRIPTION_URL,
  TAG_IS_SYSTEM_TAG_URL,
} from '../../../src/billing/shared';

// Local const so that DEPRECATED system doesn't get imported from utils
const CODE_SYSTEM_HCPCS = 'http://www.cms.gov/Medicare/Coding/HCPCSReleaseCodeSets'; // formerly used by Ottehr clinical in-house meds

const clinicalResources: {
  encounter: Encounter;
  patient: Patient;
  appointment: Appointment;
  location: Location;
  practitioner: Practitioner;
  account: Account;
  coverage: Coverage;
  conditions: Condition[];
  procedure: Procedure;
  billingProvider: Organization;
} = {
  encounter: {
    resourceType: 'Encounter',
    id: 'encounter-123',
    class: {},
    status: 'finished',
    subject: {
      reference: 'Patient/patient-123',
    },
    appointment: [
      {
        reference: 'Appointment/appointment-123',
      },
    ],
    location: [
      {
        location: {
          reference: 'Location/location-123',
        },
      },
    ],
    participant: [
      {
        individual: {
          reference: 'Practitioner/practitioner-123',
        },
        type: [
          {
            coding: [
              {
                system: PARTICIPATION_CODE_SYSTEM,
                code: 'ATND',
              },
            ],
          },
        ],
      },
    ],
    diagnosis: [
      {
        condition: {
          reference: 'Condition/condition-123',
        },
        rank: 1,
      },
      {
        condition: {
          reference: 'Condition/other-condition-456',
        },
      },
    ],
    extension: [
      {
        url: ENCOUNTER_PAYMENT_VARIANT_EXTENSION_URL,
        valueString: PaymentVariant.insurance,
      },
    ],
  },
  patient: {
    resourceType: 'Patient',
    id: 'patient-123',
  },
  appointment: {
    resourceType: 'Appointment',
    id: 'appointment-123',
    status: 'fulfilled',
    participant: [],
    serviceCategory: [{ coding: [{ system: SERVICE_CATEGORY_SYSTEM, code: 'urgent-care' }] }],
    start: '2026-01-01',
  },
  location: {
    resourceType: 'Location',
    id: 'location-123',
  },
  practitioner: {
    resourceType: 'Practitioner',
    id: 'practitioner-123',
    identifier: [{ system: FHIR_IDENTIFIER_NPI, value: '11111111111' }],
  },
  account: {
    resourceType: 'Account',
    id: 'account-123',
    status: 'active',
    type: {
      coding: [
        {
          system: ACCOUNT_TYPE_CODE_SYSTEM,
          code: 'PBILLACCT',
        },
      ],
    },
    coverage: [{ coverage: { reference: 'Coverage/coverage-123' }, priority: 1 }],
    subject: [{ reference: 'Patient/patient-123' }],
  },
  coverage: {
    resourceType: 'Coverage',
    id: 'coverage-123',
    payor: [{ reference: 'https://rcm-api.zapehr.com/v1/payer/payer-123' }],
    status: 'active',
    beneficiary: { reference: 'Patient/patient-123' },
    subscriber: {
      reference: '#subscriber',
    },
    subscriberId: '123',
    contained: [
      {
        resourceType: 'RelatedPerson',
        id: 'subscriber',
        patient: { reference: 'Patient/patient-123' },
      },
    ],
  },
  conditions: [
    {
      resourceType: 'Condition',
      id: 'other-condition-456',
      subject: {
        reference: 'Patient/patient-123',
      },
      code: {
        coding: [
          {
            system: CODE_SYSTEM_ICD_10,
            code: 'E08.10',
            display: 'Diabetes mellitus due to underlying condition with ketoacidosis without coma',
          },
        ],
      },
    },
    {
      resourceType: 'Condition',
      id: 'condition-123',
      subject: {
        reference: 'Patient/patient-123',
      },
      code: {
        coding: [
          {
            system: CODE_SYSTEM_ICD_10,
            code: 'S06.1XAS',
            display: 'Traumatic cerebral edema with loss of consciousness status unknown, sequela',
          },
        ],
      },
    },
  ],
  procedure: {
    resourceType: 'Procedure',
    id: 'procedure-123',
    status: 'completed',
    subject: {
      reference: 'Patient/patient-123',
    },
    code: {
      coding: [
        {
          system: CODE_SYSTEM_CPT,
          code: '12345',
          extension: [
            {
              url: EXTENSION_URL_CPT_MODIFIER,
              valueCodeableConcept: {
                coding: [
                  {
                    system: CODE_SYSTEM_CPT_MODIFIER,
                    code: '25',
                  },
                ],
              },
            },
          ],
        },
      ],
    },
  },
  billingProvider: {
    resourceType: 'Organization',
    id: 'organization-123',
  },
};

const billingResources: {
  person: Person;
  patient: Patient;
  account: Account;
  coverage: Coverage;
  relatedPerson: RelatedPerson;
  location: Location;
  practitioner: Practitioner;
  billingProvider: Organization;
  autoAccidentTag: Basic;
  billingService: Basic;
  chargeMasterInsurance: ChargeItemDefinition;
  chargeMasterSelfPay: ChargeItemDefinition;
} = {
  person: {
    resourceType: 'Person',
    id: 'billing-person-123',
  },
  patient: {
    resourceType: 'Patient',
    id: 'billing-patient-123',
    extension: [
      { url: 'https://fhir.ottehr.com/billing/source-resource', valueReference: { reference: 'Patient/patient-123' } },
    ],
    meta: {
      tag: [BILLING_RESOURCE_TAG],
    },
  },
  account: {
    resourceType: 'Account',
    id: 'billing-account-123',
    status: 'active',
    type: {
      coding: [
        {
          system: ACCOUNT_TYPE_CODE_SYSTEM,
          code: 'PBILLACCT',
        },
      ],
    },
    coverage: [{ coverage: { reference: 'Coverage/billing-coverage-123' }, priority: 1 }],
    subject: [{ reference: 'Patient/billing-patient-123' }],
    extension: [
      { url: 'https://fhir.ottehr.com/billing/source-resource', valueReference: { reference: 'Account/account-123' } },
    ],
  },
  coverage: {
    resourceType: 'Coverage',
    id: 'billing-coverage-123',
    payor: [{ reference: 'https://rcm-api.zapehr.com/v1/payer/payer-123' }],
    status: 'active',
    beneficiary: { reference: 'Patient/billing-patient-123' },
    subscriber: { reference: 'RelatedPerson/billing-related-person-123' },
    subscriberId: '123',
    extension: [
      {
        url: 'https://fhir.ottehr.com/billing/source-resource',
        valueReference: { reference: 'Coverage/coverage-123' },
      },
    ],
  },
  relatedPerson: {
    resourceType: 'RelatedPerson',
    id: 'billing-related-person-123',
    patient: { reference: 'Patient/billing-patient-123' },
  },
  location: {
    resourceType: 'Location',
    id: 'billing-location-123',
    extension: [
      {
        url: CODE_SYSTEM_CMS_PLACE_OF_SERVICE,
        valueString: '20',
      },
    ],
  },
  practitioner: {
    resourceType: 'Practitioner',
    id: 'billing-practitioner-123',
    identifier: [{ system: FHIR_IDENTIFIER_NPI, value: '11111111111' }],
  },
  billingProvider: {
    resourceType: 'Organization',
    id: 'billing-organization-123',
  },
  autoAccidentTag: {
    resourceType: 'Basic',
    code: { text: AUTO_ACCIDENT_TAG_NAME, coding: [{ system: TAG_CODE_SYSTEM, code: 'tag' }] },
    extension: [
      { url: TAG_DESCRIPTION_URL, valueString: AUTO_ACCIDENT_TAG_DESCRIPTION },
      { url: TAG_IS_SYSTEM_TAG_URL, valueBoolean: true },
    ],
  },
  billingService: {
    resourceType: 'Basic',
    code: { text: 'urgent-care', coding: [{ system: CODE_SYSTEM_SERVICE_CATEGORY_TAG_SYSTEM, code: 'urgent-care' }] },
  },
  chargeMasterInsurance: {
    resourceType: 'ChargeItemDefinition',
    title: 'insurance default',
    url: 'insurance-default',
    date: '2026-01-01',
    status: 'active',
    propertyGroup: [
      {
        priceComponent: [
          {
            type: 'base',
            code: {
              coding: [
                {
                  system: CPT_CODE_SYSTEM,
                  code: '12345',
                },
              ],
            },
            amount: {
              currency: 'USD',
              value: 20,
            },
            extension: [{ url: EXTENSION_URL_CPT_MODIFIER, valueCode: '25' }],
          },
        ],
      },
    ],
    meta: {
      tag: [
        {
          system: CHARGE_ITEM_DEFINITION_DEFAULT_SYSTEM,
          code: 'insurance',
        },
      ],
    },
  },
  chargeMasterSelfPay: {
    resourceType: 'ChargeItemDefinition',
    title: 'self-pay default',
    url: 'self-pay-default',
    date: '2026-01-01',
    status: 'active',
    propertyGroup: [
      {
        priceComponent: [
          {
            type: 'base',
            code: {
              coding: [
                {
                  system: CPT_CODE_SYSTEM,
                  code: '12345',
                },
              ],
            },
            amount: {
              currency: 'USD',
              value: 10,
            },
          },
        ],
      },
    ],
    meta: {
      tag: [
        {
          system: CHARGE_ITEM_DEFINITION_DEFAULT_SYSTEM,
          code: 'self-pay',
        },
      ],
    },
  },
};

const oystehrResources: { payor: Organization } = {
  payor: { resourceType: 'Organization', id: 'payer-123' },
};

const emptyAccount = { ...structuredClone(clinicalResources.account), coverage: [] };

describe('create-billing-claim-from-encounter', () => {
  describe('validation', () => {
    it('throws validation error on empty body', async () => {
      expect(() => validateRequestParameters({ headers: null, body: null, secrets: null })).toThrow(
        expect.objectContaining(MISSING_REQUEST_BODY)
      );
    });
    it('throws validation error on empty secrets', async () => {
      expect(() => validateRequestParameters({ headers: null, body: '{}', secrets: null })).toThrow(
        expect.objectContaining(MISSING_REQUEST_SECRETS)
      );
    });
    it('throws validation error on non-json body', async () => {
      expect(() => validateRequestParameters({ headers: null, body: 'some text', secrets: {} })).toThrow(
        expect.objectContaining(INVALID_INPUT_ERROR('Invalid JSON in request body'))
      );
    });
    it('throws validation error on missing encounter id', async () => {
      expect(() => validateRequestParameters({ headers: null, body: '{}', secrets: {} })).toThrow(
        expect.objectContaining(INVALID_INPUT_ERROR('Validation error: Required at "encounterId"'))
      );
    });
    it('succeeds', async () => {
      const input = validateRequestParameters({
        headers: null,
        body: '{"encounterId":"77e32d5e-bb84-4604-beb8-d755869f9715"}',
        secrets: {},
      });
      expect(input).toStrictEqual({ encounterId: '77e32d5e-bb84-4604-beb8-d755869f9715', secrets: {} });
    });
  });

  describe('complex validation', () => {
    const encounterId = '77e32d5e-bb84-4604-beb8-d755869f9715';
    const tt: {
      name: string;
      clinicalOystehrSearch: Mock;
      billingOystehrSearch: Mock;
      secrets?: Record<string, string>;
      expectedError: APIError | null;
      expectedResult?: ComplexValidationOutput | null;
    }[] = [
      {
        name: 'throws error when has existing claim',
        clinicalOystehrSearch: vi.fn(),
        billingOystehrSearch: vi.fn().mockResolvedValueOnce({
          unbundle: () => [
            {
              resourceType: 'Claim',
              id: 'claim-123',
              identifier: {
                system: ottehrIdentifierSystem('claim-encounter-id'),
                value: encounterId,
              },
            },
          ],
        }),
        expectedError: INVALID_INPUT_ERROR('Claim has already been created for this encounter'),
      },
      {
        name: 'throws error when missing encounter',
        clinicalOystehrSearch: vi.fn().mockResolvedValueOnce({
          unbundle: () => [],
        }),
        billingOystehrSearch: vi.fn().mockResolvedValueOnce({
          unbundle: () => [],
        }),
        expectedError: FHIR_RESOURCE_NOT_FOUND('Encounter'),
      },
      {
        name: 'throws error when missing patient',
        clinicalOystehrSearch: vi.fn().mockResolvedValueOnce({
          unbundle: () => [clinicalResources.encounter],
        }),
        billingOystehrSearch: vi.fn().mockResolvedValueOnce({
          unbundle: () => [],
        }),
        expectedError: FHIR_RESOURCE_NOT_FOUND('Patient'),
      },
      {
        name: 'throws error when patient does not match reference',
        clinicalOystehrSearch: vi.fn().mockResolvedValueOnce({
          unbundle: () => [
            clinicalResources.encounter,
            {
              resourceType: 'Patient',
              id: 'patient-456',
            },
          ],
        }),
        billingOystehrSearch: vi.fn().mockResolvedValueOnce({
          unbundle: () => [],
        }),
        expectedError: FHIR_RESOURCE_NOT_FOUND('Patient'),
      },
      {
        name: 'throws error when appointment does not exist',
        clinicalOystehrSearch: vi.fn().mockResolvedValueOnce({
          unbundle: () => [clinicalResources.encounter, clinicalResources.patient],
        }),
        billingOystehrSearch: vi.fn().mockResolvedValueOnce({
          unbundle: () => [],
        }),
        expectedError: FHIR_RESOURCE_NOT_FOUND('Appointment'),
      },
      {
        name: 'throws error when appointment does not match reference',
        clinicalOystehrSearch: vi.fn().mockResolvedValueOnce({
          unbundle: () => [
            clinicalResources.encounter,
            clinicalResources.patient,
            {
              resourceType: 'Appointment',
              id: 'appointment-456',
            },
          ],
        }),
        billingOystehrSearch: vi.fn().mockResolvedValueOnce({
          unbundle: () => [],
        }),
        expectedError: FHIR_RESOURCE_NOT_FOUND('Appointment'),
      },
      {
        name: 'throws error when location does not exist',
        clinicalOystehrSearch: vi.fn().mockResolvedValueOnce({
          unbundle: () => [clinicalResources.encounter, clinicalResources.patient, clinicalResources.appointment],
        }),
        billingOystehrSearch: vi.fn().mockResolvedValueOnce({
          unbundle: () => [],
        }),
        expectedError: FHIR_RESOURCE_NOT_FOUND('Location'),
      },
      {
        name: 'throws error when location does not match reference',
        clinicalOystehrSearch: vi.fn().mockResolvedValueOnce({
          unbundle: () => [
            clinicalResources.encounter,
            clinicalResources.patient,
            clinicalResources.appointment,
            {
              resourceType: 'Location',
              id: 'location-456',
            },
          ],
        }),
        billingOystehrSearch: vi.fn().mockResolvedValueOnce({
          unbundle: () => [],
        }),
        expectedError: FHIR_RESOURCE_NOT_FOUND('Location'),
      },
      {
        name: 'throws error when practitioner does not exist',
        clinicalOystehrSearch: vi.fn().mockResolvedValueOnce({
          unbundle: () => [
            clinicalResources.encounter,
            clinicalResources.patient,
            clinicalResources.appointment,
            clinicalResources.location,
          ],
        }),
        billingOystehrSearch: vi.fn().mockResolvedValueOnce({
          unbundle: () => [],
        }),
        expectedError: FHIR_RESOURCE_NOT_FOUND('Practitioner'),
      },
      {
        name: 'throws error when account does not exist',
        clinicalOystehrSearch: vi.fn().mockResolvedValueOnce({
          unbundle: () => [
            clinicalResources.encounter,
            clinicalResources.patient,
            clinicalResources.appointment,
            clinicalResources.location,
            clinicalResources.practitioner,
          ],
        }),
        billingOystehrSearch: vi.fn().mockResolvedValueOnce({
          unbundle: () => [],
        }),
        expectedError: FHIR_RESOURCE_NOT_FOUND('Account'),
      },
      {
        name: 'throws error when diagnosis does not exist',
        clinicalOystehrSearch: vi.fn().mockResolvedValueOnce({
          unbundle: () => [
            clinicalResources.encounter,
            clinicalResources.patient,
            clinicalResources.appointment,
            clinicalResources.location,
            clinicalResources.practitioner,
            clinicalResources.account,
          ],
        }),
        billingOystehrSearch: vi.fn().mockResolvedValueOnce({
          unbundle: () => [],
        }),
        expectedError: FHIR_RESOURCE_NOT_FOUND('Condition'),
      },
      {
        name: 'throws error when procedure does not exist',
        clinicalOystehrSearch: vi.fn().mockResolvedValueOnce({
          unbundle: () => [
            clinicalResources.encounter,
            clinicalResources.patient,
            clinicalResources.appointment,
            clinicalResources.location,
            clinicalResources.practitioner,
            clinicalResources.account,
            ...clinicalResources.conditions,
          ],
        }),
        billingOystehrSearch: vi.fn().mockResolvedValueOnce({
          unbundle: () => [],
        }),
        expectedError: FHIR_RESOURCE_NOT_FOUND('Procedure'),
      },
      {
        name: 'throws error when coverage does not exist',
        clinicalOystehrSearch: vi
          .fn()
          .mockResolvedValueOnce({
            unbundle: () => [
              clinicalResources.encounter,
              clinicalResources.patient,
              clinicalResources.appointment,
              clinicalResources.location,
              clinicalResources.practitioner,
              clinicalResources.account,
              ...clinicalResources.conditions,
              clinicalResources.procedure,
            ],
          })
          .mockResolvedValueOnce({ unbundle: () => [] }),
        billingOystehrSearch: vi.fn().mockResolvedValueOnce({
          unbundle: () => [],
        }),
        expectedError: FHIR_RESOURCE_NOT_FOUND('Coverage'),
      },
      {
        name: 'throws error when coverage does not have payor',
        clinicalOystehrSearch: vi
          .fn()
          .mockResolvedValueOnce({
            unbundle: () => [
              clinicalResources.encounter,
              clinicalResources.patient,
              clinicalResources.appointment,
              clinicalResources.location,
              clinicalResources.practitioner,
              clinicalResources.account,
              ...clinicalResources.conditions,
              clinicalResources.procedure,
            ],
          })
          .mockResolvedValueOnce({
            unbundle: () => [
              {
                ...clinicalResources.coverage,
                payor: undefined,
              },
            ],
          }),
        billingOystehrSearch: vi.fn().mockResolvedValueOnce({
          unbundle: () => [],
        }),
        expectedError: FHIR_RESOURCE_NOT_FOUND('Organization'),
      },
      {
        name: 'throws error when billing provider not in secrets',
        clinicalOystehrSearch: vi
          .fn()
          .mockResolvedValueOnce({
            unbundle: () => [
              clinicalResources.encounter,
              clinicalResources.patient,
              clinicalResources.appointment,
              clinicalResources.location,
              clinicalResources.practitioner,
              clinicalResources.account,
              ...clinicalResources.conditions,
              clinicalResources.procedure,
            ],
          })
          .mockResolvedValueOnce({
            unbundle: () => [clinicalResources.coverage],
          }),
        billingOystehrSearch: vi.fn().mockResolvedValueOnce({
          unbundle: () => [],
        }),
        expectedError: FHIR_RESOURCE_NOT_FOUND('Organization'),
      },
      {
        name: 'throws error when billing provider does not exist',
        clinicalOystehrSearch: vi
          .fn()
          .mockResolvedValueOnce({
            unbundle: () => [
              clinicalResources.encounter,
              clinicalResources.patient,
              clinicalResources.appointment,
              clinicalResources.location,
              clinicalResources.practitioner,
              clinicalResources.account,
              clinicalResources.coverage,
              ...clinicalResources.conditions,
              clinicalResources.procedure,
            ],
          })
          .mockResolvedValueOnce({
            unbundle: () => [clinicalResources.coverage],
          })
          .mockResolvedValueOnce({
            unbundle: () => [],
          }),
        billingOystehrSearch: vi.fn().mockResolvedValueOnce({
          unbundle: () => [],
        }),
        secrets: { DEFAULT_BILLING_RESOURCE: 'Organization/organization-123' },
        expectedError: FHIR_RESOURCE_NOT_FOUND('Organization'),
      },
      {
        name: 'succeeds with required data and no found billing resources',
        clinicalOystehrSearch: vi
          .fn()
          .mockResolvedValueOnce({
            unbundle: () => [
              clinicalResources.encounter,
              clinicalResources.patient,
              clinicalResources.appointment,
              clinicalResources.location,
              clinicalResources.practitioner,
              clinicalResources.account,
              clinicalResources.coverage,
              ...clinicalResources.conditions,
              clinicalResources.procedure,
            ],
          })
          .mockResolvedValueOnce({
            unbundle: () => [clinicalResources.coverage],
          })
          .mockResolvedValueOnce({
            unbundle: () => [clinicalResources.billingProvider],
          }),
        billingOystehrSearch: vi
          .fn()
          .mockResolvedValueOnce({
            unbundle: () => [],
          })
          .mockResolvedValueOnce({
            unbundle: () => [],
          })
          .mockResolvedValueOnce({
            unbundle: () => [],
          })
          .mockResolvedValueOnce({
            unbundle: () => [],
          })
          .mockResolvedValueOnce({
            unbundle: () => [],
          })
          .mockResolvedValueOnce({
            unbundle: () => [],
          })
          .mockResolvedValueOnce({
            unbundle: () => [],
          })
          .mockResolvedValueOnce({
            unbundle: () => [],
          }),
        secrets: { DEFAULT_BILLING_RESOURCE: 'Organization/organization-123' },
        expectedError: null,
        expectedResult: {
          clinicalResources: {
            accounts: [clinicalResources.account],
            appointment: clinicalResources.appointment,
            billingProvider: clinicalResources.billingProvider,
            coverages: [clinicalResources.coverage],
            diagnoses: [clinicalResources.conditions[1], clinicalResources.conditions[0]],
            encounter: clinicalResources.encounter,
            location: clinicalResources.location,
            patient: clinicalResources.patient,
            payors: [oystehrResources.payor],
            practitioners: [clinicalResources.practitioner],
            procedures: [clinicalResources.procedure],
          },
          billingResources: {
            accounts: [],
            billingProvider: undefined,
            coverages: [],
            mainPatient: undefined,
            person: undefined,
            practitioners: [],
            renderingProvider: undefined,
            serviceFacility: undefined,
            subscribers: [],
            autoAccidentTag: undefined,
            billingService: undefined,
            chargeMaster: undefined,
          },
        },
      },
      {
        name: 'succeeds with empty patient account and no found billing resources',
        clinicalOystehrSearch: vi
          .fn()
          .mockResolvedValueOnce({
            unbundle: () => [
              clinicalResources.encounter,
              clinicalResources.patient,
              clinicalResources.appointment,
              clinicalResources.location,
              clinicalResources.practitioner,
              emptyAccount,
              ...clinicalResources.conditions,
              clinicalResources.procedure,
            ],
          })
          .mockResolvedValueOnce({
            unbundle: () => [clinicalResources.billingProvider],
          }),
        billingOystehrSearch: vi
          .fn()
          .mockResolvedValueOnce({
            unbundle: () => [],
          })
          .mockResolvedValueOnce({
            unbundle: () => [],
          })
          .mockResolvedValueOnce({
            unbundle: () => [],
          })
          .mockResolvedValueOnce({
            unbundle: () => [],
          })
          .mockResolvedValueOnce({
            unbundle: () => [],
          })
          .mockResolvedValueOnce({
            unbundle: () => [],
          })
          .mockResolvedValueOnce({
            unbundle: () => [],
          })
          .mockResolvedValueOnce({
            unbundle: () => [],
          }),
        secrets: { DEFAULT_BILLING_RESOURCE: 'Organization/organization-123' },
        expectedError: null,
        expectedResult: {
          clinicalResources: {
            accounts: [emptyAccount],
            appointment: clinicalResources.appointment,
            billingProvider: clinicalResources.billingProvider,
            coverages: [],
            diagnoses: [clinicalResources.conditions[1], clinicalResources.conditions[0]],
            encounter: clinicalResources.encounter,
            location: clinicalResources.location,
            patient: clinicalResources.patient,
            payors: [],
            practitioners: [clinicalResources.practitioner],
            procedures: [clinicalResources.procedure],
          },
          billingResources: {
            accounts: [],
            billingProvider: undefined,
            coverages: [],
            mainPatient: undefined,
            person: undefined,
            practitioners: [],
            renderingProvider: undefined,
            serviceFacility: undefined,
            subscribers: [],
            autoAccidentTag: undefined,
            billingService: undefined,
            chargeMaster: undefined,
          },
        },
      },
      {
        name: 'succeeds with required data and all found billing resources',
        clinicalOystehrSearch: vi
          .fn()
          .mockResolvedValueOnce({
            unbundle: () => [
              clinicalResources.encounter,
              clinicalResources.patient,
              clinicalResources.appointment,
              clinicalResources.location,
              clinicalResources.practitioner,
              clinicalResources.account,
              clinicalResources.coverage,
              ...clinicalResources.conditions,
              clinicalResources.procedure,
            ],
          })
          .mockResolvedValueOnce({
            unbundle: () => [clinicalResources.coverage],
          })
          .mockResolvedValueOnce({
            unbundle: () => [clinicalResources.billingProvider],
          }),
        billingOystehrSearch: vi
          .fn()
          .mockResolvedValueOnce({
            // Existing claim
            unbundle: () => [],
          })
          .mockResolvedValueOnce({
            unbundle: () => [billingResources.person, billingResources.patient, billingResources.account],
          })
          .mockResolvedValueOnce({
            unbundle: () => [billingResources.coverage, billingResources.relatedPerson],
          })
          .mockResolvedValueOnce({
            unbundle: () => [billingResources.location],
          })
          .mockResolvedValueOnce({
            unbundle: () => [billingResources.practitioner],
          })
          .mockResolvedValueOnce({
            unbundle: () => [billingResources.billingProvider],
          })
          .mockResolvedValueOnce({
            // Auto accident tag
            unbundle: () => [billingResources.autoAccidentTag],
          })
          .mockResolvedValueOnce({
            // Billing service
            unbundle: () => [billingResources.billingService],
          })
          .mockResolvedValueOnce({
            // Charge master
            unbundle: () => [billingResources.chargeMasterInsurance],
          }),
        secrets: { DEFAULT_BILLING_RESOURCE: 'Organization/organization-123' },
        expectedError: null,
        expectedResult: {
          clinicalResources: {
            accounts: [clinicalResources.account],
            appointment: clinicalResources.appointment,
            billingProvider: clinicalResources.billingProvider,
            coverages: [clinicalResources.coverage],
            diagnoses: [clinicalResources.conditions[1], clinicalResources.conditions[0]],
            encounter: clinicalResources.encounter,
            location: clinicalResources.location,
            patient: clinicalResources.patient,
            payors: [oystehrResources.payor],
            practitioners: [clinicalResources.practitioner],
            procedures: [clinicalResources.procedure],
          },
          billingResources: {
            accounts: [billingResources.account],
            billingProvider: billingResources.billingProvider,
            coverages: [billingResources.coverage],
            mainPatient: billingResources.patient,
            person: billingResources.person,
            practitioners: [billingResources.practitioner],
            renderingProvider: billingResources.practitioner,
            serviceFacility: billingResources.location,
            subscribers: [billingResources.relatedPerson],
            autoAccidentTag: billingResources.autoAccidentTag,
            billingService: billingResources.billingService,
            chargeMaster: billingResources.chargeMasterInsurance,
          },
        },
      },
    ];
    it.each(tt)('$name', async (tc) => {
      const expectPromise = expect(
        complexValidation(
          {
            fhir: { search: tc.clinicalOystehrSearch },
            rcm: { getPayerByUrl: vi.fn().mockResolvedValue(oystehrResources.payor) },
          } as unknown as Oystehr,
          { fhir: { search: tc.billingOystehrSearch } } as unknown as Oystehr,
          { encounterId, secrets: tc.secrets ?? {} }
        )
      );
      if (tc.expectedError) await expectPromise.rejects.toThrow(expect.objectContaining(tc.expectedError));
      else await expectPromise.resolves.toStrictEqual(tc.expectedResult);
    });
  });

  describe('copyCoverageAndSubscriber', () => {
    it('copies coverage tree for new account', () => {
      const billingOystehr = {
        rcm: { constructPayerUrl: vi.fn().mockReturnValue('https://rcm-api.zapehr.com/v1/payer/payer-123') },
      } as unknown as Oystehr;
      const [ops] = copyCoverageAndSubscriberForAccount(
        billingOystehr,
        [clinicalResources.coverage],
        clinicalResources.account,
        'urn:uuid:patient',
        [oystehrResources.payor]
      );
      expect(ops).toMatchInlineSnapshot(`
        [
          {
            "fullUrl": "urn:uuid:billing-coverage-rp-coverage-123",
            "method": "POST",
            "resource": {
              "extension": [],
              "id": "urn:uuid:billing-coverage-rp-coverage-123",
              "patient": {
                "reference": "urn:uuid:patient",
              },
              "resourceType": "RelatedPerson",
            },
            "url": "/RelatedPerson",
          },
          {
            "fullUrl": "urn:uuid:billing-coverage-coverage-123",
            "method": "POST",
            "resource": {
              "beneficiary": {
                "reference": "urn:uuid:patient",
              },
              "extension": [
                {
                  "url": "https://fhir.ottehr.com/billing/source-resource",
                  "valueReference": {
                    "reference": "Coverage/coverage-123",
                  },
                },
              ],
              "id": "urn:uuid:billing-coverage-coverage-123",
              "payor": [
                {
                  "reference": "https://rcm-api.zapehr.com/v1/payer/payer-123",
                },
              ],
              "resourceType": "Coverage",
              "status": "active",
              "subscriber": {
                "reference": "urn:uuid:billing-coverage-rp-coverage-123",
              },
              "subscriberId": "123",
            },
            "url": "/Coverage",
          },
        ]
      `);

      const [claimOps] = copyCoverageAndSubscriber(
        billingOystehr,
        ops.find((o): o is BatchInputPostRequest<Coverage> => o.url === '/Coverage')!.resource,
        'urn:uuid:claim-patient',
        [oystehrResources.payor],
        ops.find((o): o is BatchInputPostRequest<RelatedPerson> => o.url === '/RelatedPerson')!.resource,
        true
      );

      expect(claimOps).toMatchInlineSnapshot(`
        [
          {
            "fullUrl": "urn:uuid:claim-coverage-rp-billing-coverage-coverage-123",
            "method": "POST",
            "resource": {
              "extension": [
                {
                  "url": "https://fhir.ottehr.com/billing/source-resource",
                  "valueReference": {
                    "reference": "urn:uuid:billing-coverage-rp-coverage-123",
                  },
                },
              ],
              "id": "urn:uuid:claim-coverage-rp-billing-coverage-coverage-123",
              "meta": {
                "tag": [
                  {
                    "code": "billing-working-copy",
                    "system": "https://fhir.ottehr.com/billing/resource-type",
                  },
                ],
              },
              "patient": {
                "reference": "urn:uuid:patient",
              },
              "resourceType": "RelatedPerson",
            },
            "url": "/RelatedPerson",
          },
          {
            "fullUrl": "urn:uuid:claim-coverage-billing-coverage-coverage-123",
            "method": "POST",
            "resource": {
              "beneficiary": {
                "reference": "urn:uuid:claim-patient",
              },
              "extension": [
                {
                  "url": "https://fhir.ottehr.com/billing/source-resource",
                  "valueReference": {
                    "reference": "urn:uuid:billing-coverage-coverage-123",
                  },
                },
              ],
              "id": "urn:uuid:claim-coverage-billing-coverage-coverage-123",
              "meta": {
                "tag": [
                  {
                    "code": "billing-working-copy",
                    "system": "https://fhir.ottehr.com/billing/resource-type",
                  },
                ],
              },
              "payor": [
                {
                  "reference": "https://rcm-api.zapehr.com/v1/payer/payer-123",
                },
              ],
              "resourceType": "Coverage",
              "status": "active",
              "subscriber": {
                "reference": "urn:uuid:claim-coverage-rp-billing-coverage-coverage-123",
              },
              "subscriberId": "123",
            },
            "url": "/Coverage",
          },
        ]
      `);
    });
    it('copies coverages for existing account', () => {
      const billingOystehr = {
        rcm: { constructPayerUrl: vi.fn().mockReturnValue('https://rcm-api.zapehr.com/v1/payer/payer-123') },
      } as unknown as Oystehr;
      const [claimOps] = copyCoverageAndSubscriber(
        billingOystehr,
        billingResources.coverage,
        billingResources.patient.id!,
        [oystehrResources.payor],
        billingResources.relatedPerson,
        true
      );
      expect(claimOps).toMatchInlineSnapshot(`
        [
          {
            "fullUrl": "urn:uuid:claim-coverage-rp-billing-coverage-123",
            "method": "POST",
            "resource": {
              "extension": [
                {
                  "url": "https://fhir.ottehr.com/billing/source-resource",
                  "valueReference": {
                    "reference": "RelatedPerson/billing-related-person-123",
                  },
                },
              ],
              "id": "urn:uuid:claim-coverage-rp-billing-coverage-123",
              "meta": {
                "tag": [
                  {
                    "code": "billing-working-copy",
                    "system": "https://fhir.ottehr.com/billing/resource-type",
                  },
                ],
              },
              "patient": {
                "reference": "Patient/billing-patient-123",
              },
              "resourceType": "RelatedPerson",
            },
            "url": "/RelatedPerson",
          },
          {
            "fullUrl": "urn:uuid:claim-coverage-billing-coverage-123",
            "method": "POST",
            "resource": {
              "beneficiary": {
                "reference": "Patient/billing-patient-123",
              },
              "extension": [
                {
                  "url": "https://fhir.ottehr.com/billing/source-resource",
                  "valueReference": {
                    "reference": "Coverage/billing-coverage-123",
                  },
                },
              ],
              "id": "urn:uuid:claim-coverage-billing-coverage-123",
              "meta": {
                "tag": [
                  {
                    "code": "billing-working-copy",
                    "system": "https://fhir.ottehr.com/billing/resource-type",
                  },
                ],
              },
              "payor": [
                {
                  "reference": "https://rcm-api.zapehr.com/v1/payer/payer-123",
                },
              ],
              "resourceType": "Coverage",
              "status": "active",
              "subscriber": {
                "reference": "urn:uuid:claim-coverage-rp-billing-coverage-123",
              },
              "subscriberId": "123",
            },
            "url": "/Coverage",
          },
        ]
      `);
    });
  });

  describe('insurance type', () => {
    const billingOystehr = {
      rcm: {
        constructPayerUrl: vi.fn().mockReturnValue('https://rcm-api.zapehr.com/v1/payer/payer-123'),
      },
    } as unknown as Oystehr;

    const copiedCoverage = (coverage: Coverage): Coverage => {
      const [ops] = copyCoverageAndSubscriber(billingOystehr, coverage, 'urn:uuid:patient', [oystehrResources.payor]);
      return ops.find((o): o is BatchInputPostRequest<Coverage> => o.method === 'POST' && o.url === '/Coverage')!
        .resource;
    };

    it('mirrors the candid plan type from the source coverage onto the copy extension and type', () => {
      const result = copiedCoverage({
        ...clinicalResources.coverage,
        type: {
          coding: [
            {
              system: CANDID_PLAN_TYPE_SYSTEM,
              code: '12',
            },
          ],
        },
      });

      expect(result.extension).toContainEqual({
        url: EXTENSION_CLAIM_INSURANCE_TYPE,
        valueString: '12',
      });
      expect(result.type?.coding).toContainEqual({
        system: CANDID_PLAN_TYPE_SYSTEM,
        code: '12',
      });
    });

    it('adds no insurance type when the source coverage has no candid plan type', () => {
      const result = copiedCoverage(clinicalResources.coverage);
      expect(result.extension?.some((e) => e.url === EXTENSION_CLAIM_INSURANCE_TYPE)).toBe(false);
      expect(result.type?.coding?.some((c) => c.system === CANDID_PLAN_TYPE_SYSTEM)).toBeFalsy();
    });
  });

  describe('getClaimCoveragesForEncounter', () => {
    it('properly finds coverages for existing billing resources for urgent care', () => {
      const billingOystehr = {
        rcm: { constructPayerUrl: vi.fn().mockReturnValue('https://rcm-api.zapehr.com/v1/payer/payer-123') },
      } as unknown as Oystehr;
      const [claimOps] = copyCoverageAndSubscriber(
        billingOystehr,
        billingResources.coverage,
        billingResources.patient.id!,
        [oystehrResources.payor],
        billingResources.relatedPerson,
        true
      );
      const coverages = claimOps
        .filter((o): o is BatchInputPostRequest<Coverage> => o.method === 'POST' && o.url === '/Coverage')
        .map((o) => o.resource);
      const coverageRefs = getClaimCoveragesForEncounter(
        CODE_SYSTEM_SERVICE_CATEGORY_CODES['urgent-care'],
        [billingResources.account],
        coverages
      );
      expect(coverageRefs).toHaveLength(1);
      expect(coverageRefs[0].coverageRef.reference).toEqual(coverages[0].id);
      expect(coverageRefs[0].payorRef).toEqual(coverages[0].payor[0]);
    });
    it('properly finds coverages for new billing resources for urgent care', () => {
      const billingOystehr = {
        rcm: { constructPayerUrl: vi.fn().mockReturnValue('https://rcm-api.zapehr.com/v1/payer/payer-123') },
      } as unknown as Oystehr;
      const [ops] = copyCoverageAndSubscriberForAccount(
        billingOystehr,
        [clinicalResources.coverage],
        clinicalResources.account,
        'urn:uuid:patient',
        [oystehrResources.payor]
      );
      const billingCoverages = ops
        .filter((o): o is BatchInputPostRequest<Coverage> => o.method === 'POST' && o.url === '/Coverage')
        .map((o) => o.resource);
      const accountCopy = copyAccount(clinicalResources.account, 'urn:uuid:patient', billingCoverages);
      const [claimOps] = copyCoverageAndSubscriber(
        billingOystehr,
        ops.find((o): o is BatchInputPostRequest<Coverage> => o.url === '/Coverage')!.resource,
        'urn:uuid:claim-patient',
        [oystehrResources.payor],
        ops.find((o): o is BatchInputPostRequest<RelatedPerson> => o.url === '/RelatedPerson')!.resource,
        true
      );
      const claimCoverages = claimOps
        .filter((o): o is BatchInputPostRequest<Coverage> => o.method === 'POST' && o.url === '/Coverage')
        .map((o) => o.resource);
      const coverageRefs = getClaimCoveragesForEncounter(
        CODE_SYSTEM_SERVICE_CATEGORY_CODES['urgent-care'],
        [accountCopy],
        claimCoverages
      );
      expect(coverageRefs).toHaveLength(1);
      expect(coverageRefs[0].coverageRef.reference).toEqual(claimCoverages[0].id);
      expect(coverageRefs[0].payorRef).toEqual(claimCoverages[0].payor[0]);
    });
  });

  const TEST_PROVENANCE_AGENT = { who: { reference: 'Practitioner/test-user' } };

  describe('performEffect', () => {
    it('creates all billing resources and claim when none exist yet', async () => {
      const txFn = vi.fn().mockResolvedValueOnce({
        entry: [
          { resource: { resourceType: 'Patient', id: 'billing-patient' } },
          { resource: { resourceType: 'Patient', id: 'claim-patient' } },
          { resource: { resourceType: 'RelatedPerson', id: 'billing-subscriber' } },
          { resource: { resourceType: 'Coverage', id: 'billing-coverage' } },
          { resource: { resourceType: 'Account', id: 'billing-account' } },
          { resource: { resourceType: 'RelatedPerson', id: 'claim-subscriber' } },
          { resource: { resourceType: 'Coverage', id: 'claim-coverage' } },
          { resource: { resourceType: 'Person', id: 'billing-person' } },
          { resource: { resourceType: 'Basic', id: 'billing-service-basic' } },
          { resource: { resourceType: 'Claim', id: 'claim' } },
          { resource: { resourceType: 'Provenance', id: 'provenance' } },
        ],
      });
      const billingOystehr = {
        fhir: { transaction: txFn },
        rcm: { constructPayerUrl: vi.fn().mockReturnValue('https://rcm-api.zapehr.com/v1/payer/payer-123') },
      } as unknown as Oystehr;
      const cvo: ComplexValidationOutput = {
        clinicalResources: {
          accounts: [clinicalResources.account],
          appointment: clinicalResources.appointment,
          billingProvider: clinicalResources.billingProvider,
          coverages: [clinicalResources.coverage],
          diagnoses: [...clinicalResources.conditions],
          encounter: clinicalResources.encounter,
          location: clinicalResources.location,
          patient: clinicalResources.patient,
          payors: [oystehrResources.payor],
          practitioners: [clinicalResources.practitioner],
          procedures: [clinicalResources.procedure],
        },
        billingResources: {
          accounts: [],
          billingProvider: undefined,
          coverages: [],
          mainPatient: undefined,
          person: undefined,
          practitioners: [],
          renderingProvider: undefined,
          serviceFacility: undefined,
          subscribers: [],
        },
      };
      const result = await performEffect(billingOystehr, cvo, TEST_PROVENANCE_AGENT);
      expect(result.claimId).toEqual('claim');
      expect(txFn).toHaveBeenCalledWith({
        requests: expect.arrayContaining([
          {
            method: 'POST',
            url: '/Claim',
            fullUrl: 'urn:uuid:claim',
            resource: {
              resourceType: 'Claim',
              identifier: [
                { system: ottehrIdentifierSystem('claim-encounter-id'), value: 'encounter-123' },
                { system: ottehrIdentifierSystem('claim-appointment-id'), value: 'appointment-123' },
              ],
              status: 'draft',
              meta: {
                tag: [
                  { system: CURRENT_STATUS_TAG_SYSTEM, code: 'open' },
                  { system: CODE_SYSTEM_CLAIM_TYPE, code: CODE_SYSTEM_CLAIM_TYPE_CODES.professional },
                  { system: CODE_SYSTEM_SERVICE_CATEGORY_TAG_SYSTEM, code: 'urgent-care' },
                  { system: CLAIM_STATUS_TAG_SYSTEMS.arStage, code: AR_STAGE.insurancePayer },
                  { system: CLAIM_STATUS_TAG_SYSTEMS.insuranceArStatus, code: 'created' },
                ],
              },
              type: { coding: [{ system: CODE_SYSTEM_CLAIM_TYPE, code: CODE_SYSTEM_CLAIM_TYPE_CODES.professional }] },
              use: 'claim',
              created: expect.any(String),
              extension: getDefaultClaimSubmissionExtensions(),
              patient: {
                reference: 'urn:uuid:claim-patient',
              },
              provider: { display: 'Unknown' },
              facility: undefined,
              insurer: { reference: 'https://rcm-api.zapehr.com/v1/payer/payer-123' },
              insurance: [
                {
                  sequence: 1,
                  focal: true,
                  coverage: { reference: 'urn:uuid:claim-coverage-billing-coverage-coverage-123' },
                },
              ],
              careTeam: undefined,
              diagnosis: [
                { sequence: 1, diagnosisCodeableConcept: clinicalResources.conditions[0].code },
                { sequence: 2, diagnosisCodeableConcept: clinicalResources.conditions[1].code },
              ],
              priority: { coding: [{ system: CODE_SYSTEM_PROCESS_PRIORITY, code: 'normal' }] },
              total: {
                currency: 'USD',
                value: 0,
              },
              item: [
                {
                  sequence: 1,
                  careTeamSequence: undefined,
                  diagnosisSequence: [1],
                  productOrService: clinicalResources.procedure.code,
                  modifier: [
                    {
                      coding: [
                        {
                          code: '25',
                          system: 'https://terminology.fhir.oystehr.com/CodeSystem/rcm-claim-procedure-modifier',
                        },
                      ],
                    },
                  ],
                  servicedPeriod: {
                    start: expect.any(String),
                    end: undefined,
                  },
                  locationCodeableConcept: undefined,
                  net: {
                    currency: 'USD',
                    value: 0,
                  },
                  quantity: { value: 1, unit: 'UN' },
                },
              ],
            },
          },
        ]),
      });
    });
    it('creates multiple claim-level coverages when patient has multiple accounts', async () => {
      const txFn = vi.fn().mockResolvedValueOnce({
        entry: [
          { resource: { resourceType: 'Patient', id: 'billing-patient' } },
          { resource: { resourceType: 'Patient', id: 'claim-patient' } },
          { resource: { resourceType: 'RelatedPerson', id: 'billing-subscriber' } },
          { resource: { resourceType: 'Coverage', id: 'billing-coverage' } },
          { resource: { resourceType: 'Account', id: 'billing-account' } },
          { resource: { resourceType: 'RelatedPerson', id: 'other-billing-subscriber' } },
          { resource: { resourceType: 'Coverage', id: 'other-billing-coverage' } },
          { resource: { resourceType: 'Account', id: 'other-billing-account' } },
          { resource: { resourceType: 'RelatedPerson', id: 'claim-subscriber' } },
          { resource: { resourceType: 'Coverage', id: 'claim-coverage' } },
          { resource: { resourceType: 'RelatedPerson', id: 'other-claim-subscriber' } },
          { resource: { resourceType: 'Coverage', id: 'other-claim-coverage' } },
          { resource: { resourceType: 'Person', id: 'billing-person' } },
          { resource: { resourceType: 'Basic', id: 'billing-service-basic' } },
          { resource: { resourceType: 'Claim', id: 'claim' } },
          { resource: { resourceType: 'Provenance', id: 'provenance' } },
        ],
      });
      const billingOystehr = {
        fhir: { transaction: txFn },
        rcm: { constructPayerUrl: vi.fn().mockReturnValue('https://rcm-api.zapehr.com/v1/payer/payer-123') },
      } as unknown as Oystehr;
      const wcAcct = structuredClone({ ...clinicalResources.account });
      wcAcct.type!.coding![0].code = 'WCOMPACCT';
      delete wcAcct.coverage![0].priority;
      const cvo: ComplexValidationOutput = {
        clinicalResources: {
          accounts: [clinicalResources.account, wcAcct],
          appointment: clinicalResources.appointment,
          billingProvider: clinicalResources.billingProvider,
          coverages: [clinicalResources.coverage],
          diagnoses: [...clinicalResources.conditions],
          encounter: clinicalResources.encounter,
          location: clinicalResources.location,
          patient: clinicalResources.patient,
          payors: [oystehrResources.payor],
          practitioners: [clinicalResources.practitioner],
          procedures: [clinicalResources.procedure],
        },
        billingResources: {
          accounts: [],
          billingProvider: undefined,
          coverages: [],
          mainPatient: undefined,
          person: undefined,
          practitioners: [],
          renderingProvider: undefined,
          serviceFacility: undefined,
          subscribers: [],
        },
      };
      const result = await performEffect(billingOystehr, cvo, TEST_PROVENANCE_AGENT);
      expect(result.claimId).toEqual('claim');
      // Expect coverage pointed at by both accounts to be copied twice
      expect(txFn).toHaveBeenCalledWith({
        requests: expect.arrayContaining([
          {
            method: 'POST',
            url: '/Coverage',
            resource: {
              resourceType: 'Coverage',
              status: 'active',
              subscriber: {
                reference: 'urn:uuid:claim-coverage-rp-billing-coverage-coverage-123',
              },
              beneficiary: {
                reference: 'urn:uuid:claim-patient',
              },
              payor: [{ reference: 'https://rcm-api.zapehr.com/v1/payer/payer-123' }],
              subscriberId: '123',
              extension: [
                {
                  url: 'https://fhir.ottehr.com/billing/source-resource',
                  valueReference: {
                    reference: 'urn:uuid:billing-coverage-coverage-123',
                  },
                },
              ],
              meta: {
                tag: [
                  {
                    system: 'https://fhir.ottehr.com/billing/resource-type',
                    code: 'billing-working-copy',
                  },
                ],
              },
            },
            fullUrl: 'urn:uuid:claim-coverage-billing-coverage-coverage-123',
          },
          {
            method: 'POST',
            url: '/Coverage',
            resource: {
              resourceType: 'Coverage',
              status: 'active',
              subscriber: {
                reference: 'urn:uuid:claim-coverage-rp-billing-coverage-coverage-123',
              },
              beneficiary: {
                reference: 'urn:uuid:claim-patient',
              },
              payor: [{ reference: 'https://rcm-api.zapehr.com/v1/payer/payer-123' }],
              subscriberId: '123',
              extension: [
                {
                  url: 'https://fhir.ottehr.com/billing/source-resource',
                  valueReference: {
                    reference: 'urn:uuid:billing-coverage-coverage-123',
                  },
                },
              ],
              meta: {
                tag: [
                  {
                    system: 'https://fhir.ottehr.com/billing/resource-type',
                    code: 'billing-working-copy',
                  },
                ],
              },
            },
            fullUrl: 'urn:uuid:claim-coverage-billing-coverage-coverage-123',
          },
        ]),
      });
    });
    it('creates no coverages when patient has empty account', async () => {
      const txFn = vi.fn().mockResolvedValueOnce({
        entry: [
          { resource: { resourceType: 'Patient', id: 'billing-patient' } },
          { resource: { resourceType: 'Patient', id: 'claim-patient' } },
          { resource: { resourceType: 'Account', id: 'billing-account' } },
          { resource: { resourceType: 'Person', id: 'billing-person' } },
          { resource: { resourceType: 'Basic', id: 'billing-service-basic' } },
          { resource: { resourceType: 'Claim', id: 'claim' } },
          { resource: { resourceType: 'Provenance', id: 'provenance' } },
        ],
      });
      const billingOystehr = {
        fhir: { transaction: txFn },
        rcm: { constructPayerUrl: vi.fn().mockReturnValue('https://rcm-api.zapehr.com/v1/payer/payer-123') },
      } as unknown as Oystehr;
      const cvo: ComplexValidationOutput = {
        clinicalResources: {
          accounts: [emptyAccount],
          appointment: clinicalResources.appointment,
          billingProvider: clinicalResources.billingProvider,
          coverages: [],
          diagnoses: [...clinicalResources.conditions],
          encounter: clinicalResources.encounter,
          location: clinicalResources.location,
          patient: clinicalResources.patient,
          payors: [oystehrResources.payor],
          practitioners: [clinicalResources.practitioner],
          procedures: [clinicalResources.procedure],
        },
        billingResources: {
          accounts: [],
          billingProvider: undefined,
          coverages: [],
          mainPatient: undefined,
          person: undefined,
          practitioners: [],
          renderingProvider: undefined,
          serviceFacility: undefined,
          subscribers: [],
        },
      };
      const result = await performEffect(billingOystehr, cvo, TEST_PROVENANCE_AGENT);
      expect(result.claimId).toEqual('claim');
      expect(txFn).toHaveBeenCalledWith({
        requests: expect.arrayContaining([
          {
            method: 'POST',
            url: '/Claim',
            fullUrl: 'urn:uuid:claim',
            resource: {
              resourceType: 'Claim',
              identifier: [
                { system: ottehrIdentifierSystem('claim-encounter-id'), value: 'encounter-123' },
                { system: ottehrIdentifierSystem('claim-appointment-id'), value: 'appointment-123' },
              ],
              status: 'draft',
              meta: {
                tag: [
                  { system: CURRENT_STATUS_TAG_SYSTEM, code: 'open' },
                  { system: CODE_SYSTEM_CLAIM_TYPE, code: CODE_SYSTEM_CLAIM_TYPE_CODES.professional },
                  { system: CODE_SYSTEM_SERVICE_CATEGORY_TAG_SYSTEM, code: 'urgent-care' },
                  { system: CLAIM_STATUS_TAG_SYSTEMS.arStage, code: AR_STAGE.insurancePayer },
                  { system: CLAIM_STATUS_TAG_SYSTEMS.insuranceArStatus, code: 'created' },
                ],
              },
              type: { coding: [{ system: CODE_SYSTEM_CLAIM_TYPE, code: CODE_SYSTEM_CLAIM_TYPE_CODES.professional }] },
              use: 'claim',
              created: expect.any(String),
              extension: getDefaultClaimSubmissionExtensions(),
              patient: {
                reference: 'urn:uuid:claim-patient',
              },
              provider: { display: 'Unknown' },
              facility: undefined,
              insurer: undefined,
              insurance: [
                {
                  coverage: {
                    display: 'No insurance coverage',
                    identifier: {
                      system: 'https://fhir.ottehr.com/billing/no-coverage',
                      value: 'no-coverage',
                    },
                  },
                  focal: true,
                  sequence: 1,
                },
              ],
              careTeam: undefined,
              diagnosis: [
                { sequence: 1, diagnosisCodeableConcept: clinicalResources.conditions[0].code },
                { sequence: 2, diagnosisCodeableConcept: clinicalResources.conditions[1].code },
              ],
              priority: { coding: [{ system: CODE_SYSTEM_PROCESS_PRIORITY, code: 'normal' }] },
              total: {
                currency: 'USD',
                value: 0,
              },
              item: [
                {
                  sequence: 1,
                  careTeamSequence: undefined,
                  diagnosisSequence: [1],
                  productOrService: clinicalResources.procedure.code,
                  modifier: [
                    {
                      coding: [
                        {
                          code: '25',
                          system: 'https://terminology.fhir.oystehr.com/CodeSystem/rcm-claim-procedure-modifier',
                        },
                      ],
                    },
                  ],
                  servicedPeriod: {
                    start: expect.any(String),
                    end: undefined,
                  },
                  locationCodeableConcept: undefined,
                  net: {
                    currency: 'USD',
                    value: 0,
                  },
                  quantity: { value: 1, unit: 'UN' },
                },
              ],
            },
          },
        ]),
      });
    });
    it('creates appropriate billing resources and claim when all exist', async () => {
      const txFn = vi.fn().mockResolvedValueOnce({
        entry: [
          { resource: { resourceType: 'Patient', id: 'billing-patient' } },
          { resource: { resourceType: 'Patient', id: 'claim-patient' } },
          { resource: { resourceType: 'RelatedPerson', id: 'claim-subscriber' } },
          { resource: { resourceType: 'Coverage', id: 'claim-coverage' } },
          { resource: { resourceType: 'Person', id: 'billing-person' } },
          { resource: { resourceType: 'Practitioner', id: 'claim-rendering-provider' } },
          { resource: { resourceType: 'Organization', id: 'claim-billing-provider' } },
          { resource: { resourceType: 'Location', id: 'claim-service-facility' } },
          { resource: { resourceType: 'Claim', id: 'claim' } },
          { resource: { resourceType: 'Provenance', id: 'provenance' } },
        ],
      });
      const billingOystehr = {
        fhir: { transaction: txFn },
        rcm: { constructPayerUrl: vi.fn().mockReturnValue('https://rcm-api.zapehr.com/v1/payer/payer-123') },
      } as unknown as Oystehr;
      const cvo: ComplexValidationOutput = {
        clinicalResources: {
          accounts: [clinicalResources.account],
          appointment: clinicalResources.appointment,
          billingProvider: clinicalResources.billingProvider,
          coverages: [clinicalResources.coverage],
          diagnoses: [...clinicalResources.conditions],
          encounter: clinicalResources.encounter,
          location: clinicalResources.location,
          patient: clinicalResources.patient,
          payors: [oystehrResources.payor],
          practitioners: [clinicalResources.practitioner],
          procedures: [clinicalResources.procedure],
        },
        billingResources: {
          accounts: [billingResources.account],
          billingProvider: billingResources.billingProvider,
          coverages: [billingResources.coverage],
          mainPatient: billingResources.patient,
          person: billingResources.person,
          practitioners: [billingResources.practitioner],
          renderingProvider: billingResources.practitioner,
          serviceFacility: billingResources.location,
          subscribers: [billingResources.relatedPerson],
          billingService: billingResources.billingService,
        },
      };
      const result = await performEffect(billingOystehr, cvo, TEST_PROVENANCE_AGENT);
      expect(result.claimId).toEqual('claim');
      expect(txFn).toHaveBeenCalledWith({
        requests: expect.arrayContaining([
          {
            method: 'POST',
            url: '/Claim',
            fullUrl: 'urn:uuid:claim',
            resource: {
              resourceType: 'Claim',
              identifier: [
                { system: ottehrIdentifierSystem('claim-encounter-id'), value: 'encounter-123' },
                { system: ottehrIdentifierSystem('claim-appointment-id'), value: 'appointment-123' },
              ],
              status: 'draft',
              meta: {
                tag: [
                  { system: CURRENT_STATUS_TAG_SYSTEM, code: 'open' },
                  { system: CODE_SYSTEM_CLAIM_TYPE, code: CODE_SYSTEM_CLAIM_TYPE_CODES.professional },
                  { system: CODE_SYSTEM_SERVICE_CATEGORY_TAG_SYSTEM, code: 'urgent-care' },
                  { system: CLAIM_STATUS_TAG_SYSTEMS.arStage, code: AR_STAGE.insurancePayer },
                  { system: CLAIM_STATUS_TAG_SYSTEMS.insuranceArStatus, code: 'created' },
                ],
              },
              type: { coding: [{ system: CODE_SYSTEM_CLAIM_TYPE, code: CODE_SYSTEM_CLAIM_TYPE_CODES.professional }] },
              use: 'claim',
              created: expect.any(String),
              extension: getDefaultClaimSubmissionExtensions(),
              patient: {
                reference: 'urn:uuid:claim-patient',
              },
              provider: { reference: 'Organization/billing-organization-123' },
              facility: {
                reference: 'Location/billing-location-123',
              },
              insurer: { reference: 'https://rcm-api.zapehr.com/v1/payer/payer-123' },
              insurance: [
                {
                  sequence: 1,
                  focal: true,
                  coverage: { reference: 'urn:uuid:claim-coverage-billing-coverage-123' },
                },
              ],
              careTeam: [
                {
                  provider: { reference: 'Practitioner/billing-practitioner-123' },
                  role: {
                    coding: [
                      {
                        code: '82',
                        system: 'https://terminology.fhir.oystehr.com/CodeSystem/rcm-claim-referring-provider-type',
                      },
                    ],
                  },
                  sequence: 1,
                },
              ],
              diagnosis: [
                { sequence: 1, diagnosisCodeableConcept: clinicalResources.conditions[0].code },
                { sequence: 2, diagnosisCodeableConcept: clinicalResources.conditions[1].code },
              ],
              priority: { coding: [{ system: CODE_SYSTEM_PROCESS_PRIORITY, code: 'normal' }] },
              total: {
                currency: 'USD',
                value: 0,
              },
              item: [
                {
                  sequence: 1,
                  careTeamSequence: [1],
                  diagnosisSequence: [1],
                  productOrService: clinicalResources.procedure.code,
                  modifier: [
                    {
                      coding: [
                        {
                          code: '25',
                          system: 'https://terminology.fhir.oystehr.com/CodeSystem/rcm-claim-procedure-modifier',
                        },
                      ],
                    },
                  ],
                  servicedPeriod: {
                    start: expect.any(String),
                    end: undefined,
                  },
                  locationCodeableConcept: {
                    coding: [
                      {
                        code: '20',
                        system:
                          'http://www.cms.gov/Medicare/Coding/place-of-service-codes/Place_of_Service_Code_Set.html',
                      },
                    ],
                  },
                  net: {
                    currency: 'USD',
                    value: 0,
                  },
                  quantity: { value: 1, unit: 'UN' },
                },
              ],
            },
          },
        ]),
      });
    });
    it('creates claim with correct billing service', async () => {
      const txFn = vi.fn().mockResolvedValue({
        entry: [
          { resource: { resourceType: 'Patient', id: 'billing-patient' } },
          { resource: { resourceType: 'Patient', id: 'claim-patient' } },
          { resource: { resourceType: 'RelatedPerson', id: 'billing-subscriber' } },
          { resource: { resourceType: 'Coverage', id: 'billing-coverage' } },
          { resource: { resourceType: 'Account', id: 'billing-account' } },
          { resource: { resourceType: 'RelatedPerson', id: 'claim-subscriber' } },
          { resource: { resourceType: 'Coverage', id: 'claim-coverage' } },
          { resource: { resourceType: 'Person', id: 'billing-person' } },
          { resource: { resourceType: 'Basic', id: 'billing-service-basic' } },
          { resource: { resourceType: 'Claim', id: 'claim' } },
          { resource: { resourceType: 'Provenance', id: 'provenance' } },
        ],
      });
      const billingOystehr = {
        fhir: { transaction: txFn },
        rcm: { constructPayerUrl: vi.fn().mockReturnValue('https://rcm-api.zapehr.com/v1/payer/payer-123') },
      } as unknown as Oystehr;
      const cvo: ComplexValidationOutput = {
        clinicalResources: {
          accounts: [clinicalResources.account],
          appointment: {
            ...clinicalResources.appointment,
            serviceCategory: [{ coding: [{ system: SERVICE_CATEGORY_SYSTEM, code: 'urgent-care' }] }],
          },
          billingProvider: clinicalResources.billingProvider,
          coverages: [clinicalResources.coverage],
          diagnoses: [...clinicalResources.conditions],
          encounter: clinicalResources.encounter,
          location: clinicalResources.location,
          patient: clinicalResources.patient,
          payors: [oystehrResources.payor],
          practitioners: [clinicalResources.practitioner],
          procedures: [clinicalResources.procedure],
        },
        billingResources: {
          accounts: [],
          billingProvider: undefined,
          coverages: [],
          mainPatient: undefined,
          person: undefined,
          practitioners: [],
          renderingProvider: undefined,
          serviceFacility: undefined,
          subscribers: [],
        },
      };
      let result = await performEffect(billingOystehr, cvo, TEST_PROVENANCE_AGENT);
      expect(result.claimId).toEqual('claim');
      expect(txFn).toHaveBeenCalledWith({
        requests: expect.arrayContaining([
          {
            method: 'POST',
            url: '/Claim',
            fullUrl: 'urn:uuid:claim',
            resource: {
              resourceType: 'Claim',
              identifier: [
                { system: ottehrIdentifierSystem('claim-encounter-id'), value: 'encounter-123' },
                { system: ottehrIdentifierSystem('claim-appointment-id'), value: 'appointment-123' },
              ],
              status: 'draft',
              meta: {
                tag: [
                  { system: CURRENT_STATUS_TAG_SYSTEM, code: 'open' },
                  { system: CODE_SYSTEM_CLAIM_TYPE, code: CODE_SYSTEM_CLAIM_TYPE_CODES.professional },
                  { system: CODE_SYSTEM_SERVICE_CATEGORY_TAG_SYSTEM, code: 'urgent-care' },
                  { system: CLAIM_STATUS_TAG_SYSTEMS.arStage, code: AR_STAGE.insurancePayer },
                  { system: CLAIM_STATUS_TAG_SYSTEMS.insuranceArStatus, code: 'created' },
                ],
              },
              type: { coding: [{ system: CODE_SYSTEM_CLAIM_TYPE, code: CODE_SYSTEM_CLAIM_TYPE_CODES.professional }] },
              use: 'claim',
              created: expect.any(String),
              extension: getDefaultClaimSubmissionExtensions(),
              patient: {
                reference: 'urn:uuid:claim-patient',
              },
              provider: { display: 'Unknown' },
              facility: undefined,
              insurer: { reference: 'https://rcm-api.zapehr.com/v1/payer/payer-123' },
              insurance: [
                {
                  sequence: 1,
                  focal: true,
                  coverage: { reference: 'urn:uuid:claim-coverage-billing-coverage-coverage-123' },
                },
              ],
              careTeam: undefined,
              diagnosis: [
                { sequence: 1, diagnosisCodeableConcept: clinicalResources.conditions[0].code },
                { sequence: 2, diagnosisCodeableConcept: clinicalResources.conditions[1].code },
              ],
              priority: { coding: [{ system: CODE_SYSTEM_PROCESS_PRIORITY, code: 'normal' }] },
              total: {
                currency: 'USD',
                value: 0,
              },
              item: [
                {
                  sequence: 1,
                  careTeamSequence: undefined,
                  diagnosisSequence: [1],
                  productOrService: clinicalResources.procedure.code,
                  modifier: [
                    {
                      coding: [
                        {
                          code: '25',
                          system: 'https://terminology.fhir.oystehr.com/CodeSystem/rcm-claim-procedure-modifier',
                        },
                      ],
                    },
                  ],
                  servicedPeriod: {
                    start: expect.any(String),
                    end: undefined,
                  },
                  locationCodeableConcept: undefined,
                  net: {
                    currency: 'USD',
                    value: 0,
                  },
                  quantity: { value: 1, unit: 'UN' },
                },
              ],
            },
          },
        ]),
      });

      let updatedAppointment = structuredClone(clinicalResources.appointment);
      updatedAppointment.serviceCategory![0].coding![0].code = 'workers-comp';
      let updatedAccount = structuredClone(clinicalResources.account);
      updatedAccount.type!.coding![0].code = 'WCOMPACCT';
      delete updatedAccount.coverage![0].priority;
      let updatedEncounter = structuredClone(clinicalResources.encounter);
      updatedEncounter.extension = [
        {
          url: ENCOUNTER_PAYMENT_VARIANT_EXTENSION_URL,
          valueString: PaymentVariant.employer,
        },
      ];
      result = await performEffect(
        billingOystehr,
        {
          clinicalResources: {
            ...cvo.clinicalResources,
            appointment: updatedAppointment,
            accounts: [updatedAccount],
            encounter: updatedEncounter,
          },
          billingResources: cvo.billingResources,
        },
        TEST_PROVENANCE_AGENT
      );
      expect(txFn).toHaveBeenCalledWith({
        requests: expect.arrayContaining([
          {
            method: 'POST',
            url: '/Claim',
            fullUrl: 'urn:uuid:claim',
            resource: {
              resourceType: 'Claim',
              identifier: [
                { system: ottehrIdentifierSystem('claim-encounter-id'), value: 'encounter-123' },
                { system: ottehrIdentifierSystem('claim-appointment-id'), value: 'appointment-123' },
              ],
              status: 'draft',
              meta: {
                tag: [
                  { system: CURRENT_STATUS_TAG_SYSTEM, code: 'open' },
                  { system: CODE_SYSTEM_CLAIM_TYPE, code: CODE_SYSTEM_CLAIM_TYPE_CODES.professional },
                  { system: CODE_SYSTEM_SERVICE_CATEGORY_TAG_SYSTEM, code: 'workers-comp' },
                  { system: CLAIM_STATUS_TAG_SYSTEMS.arStage, code: AR_STAGE.nonInsurancePayer },
                  { system: CLAIM_STATUS_TAG_SYSTEMS.nonInsuranceArStatus, code: 'created' },
                ],
              },
              type: { coding: [{ system: CODE_SYSTEM_CLAIM_TYPE, code: CODE_SYSTEM_CLAIM_TYPE_CODES.professional }] },
              use: 'claim',
              created: expect.any(String),
              extension: getDefaultClaimSubmissionExtensions(),
              patient: {
                reference: 'urn:uuid:claim-patient',
              },
              provider: { display: 'Unknown' },
              facility: undefined,
              insurer: { reference: 'https://rcm-api.zapehr.com/v1/payer/payer-123' },
              insurance: [
                {
                  sequence: 1,
                  focal: true,
                  coverage: { reference: 'urn:uuid:claim-coverage-billing-coverage-coverage-123' },
                },
              ],
              careTeam: undefined,
              diagnosis: [
                { sequence: 1, diagnosisCodeableConcept: clinicalResources.conditions[0].code },
                { sequence: 2, diagnosisCodeableConcept: clinicalResources.conditions[1].code },
              ],
              priority: { coding: [{ system: CODE_SYSTEM_PROCESS_PRIORITY, code: 'normal' }] },
              total: {
                currency: 'USD',
                value: 0,
              },
              item: [
                {
                  sequence: 1,
                  careTeamSequence: undefined,
                  diagnosisSequence: [1],
                  productOrService: clinicalResources.procedure.code,
                  modifier: [
                    {
                      coding: [
                        {
                          code: '25',
                          system: 'https://terminology.fhir.oystehr.com/CodeSystem/rcm-claim-procedure-modifier',
                        },
                      ],
                    },
                  ],
                  servicedPeriod: {
                    start: expect.any(String),
                    end: undefined,
                  },
                  locationCodeableConcept: undefined,
                  net: {
                    currency: 'USD',
                    value: 0,
                  },
                  quantity: { value: 1, unit: 'UN' },
                },
              ],
            },
          },
        ]),
      });

      updatedAppointment = structuredClone(clinicalResources.appointment);
      updatedAppointment.serviceCategory![0].coding![0].code = 'occupational-medicine';
      updatedAccount = structuredClone(clinicalResources.account);
      updatedAccount.type!.coding![0].code = 'OCCUPATIONALMEDICINEACCT';
      updatedEncounter = structuredClone(clinicalResources.encounter);
      updatedEncounter.extension = [
        {
          url: ENCOUNTER_PAYMENT_VARIANT_EXTENSION_URL,
          valueString: PaymentVariant.employer,
        },
      ];
      result = await performEffect(
        billingOystehr,
        {
          clinicalResources: {
            ...cvo.clinicalResources,
            appointment: updatedAppointment,
            accounts: [updatedAccount],
            encounter: updatedEncounter,
          },
          billingResources: cvo.billingResources,
        },
        TEST_PROVENANCE_AGENT
      );
      expect(txFn).toHaveBeenCalledWith({
        requests: expect.arrayContaining([
          {
            method: 'POST',
            url: '/Claim',
            fullUrl: 'urn:uuid:claim',
            resource: {
              resourceType: 'Claim',
              identifier: [
                { system: ottehrIdentifierSystem('claim-encounter-id'), value: 'encounter-123' },
                { system: ottehrIdentifierSystem('claim-appointment-id'), value: 'appointment-123' },
              ],
              status: 'draft',
              meta: {
                tag: [
                  { system: CURRENT_STATUS_TAG_SYSTEM, code: 'open' },
                  { system: CODE_SYSTEM_CLAIM_TYPE, code: CODE_SYSTEM_CLAIM_TYPE_CODES.professional },
                  { system: CODE_SYSTEM_SERVICE_CATEGORY_TAG_SYSTEM, code: 'occupational-medicine' },
                  { system: CLAIM_STATUS_TAG_SYSTEMS.arStage, code: AR_STAGE.nonInsurancePayer },
                  { system: CLAIM_STATUS_TAG_SYSTEMS.nonInsuranceArStatus, code: 'created' },
                ],
              },
              type: { coding: [{ system: CODE_SYSTEM_CLAIM_TYPE, code: CODE_SYSTEM_CLAIM_TYPE_CODES.professional }] },
              use: 'claim',
              created: expect.any(String),
              extension: getDefaultClaimSubmissionExtensions(),
              patient: {
                reference: 'urn:uuid:claim-patient',
              },
              provider: { display: 'Unknown' },
              facility: undefined,
              insurer: undefined,
              insurance: [buildNoCoverageStub()],
              careTeam: undefined,
              diagnosis: [
                { sequence: 1, diagnosisCodeableConcept: clinicalResources.conditions[0].code },
                { sequence: 2, diagnosisCodeableConcept: clinicalResources.conditions[1].code },
              ],
              priority: { coding: [{ system: CODE_SYSTEM_PROCESS_PRIORITY, code: 'normal' }] },
              total: {
                currency: 'USD',
                value: 0,
              },
              item: [
                {
                  sequence: 1,
                  careTeamSequence: undefined,
                  diagnosisSequence: [1],
                  productOrService: clinicalResources.procedure.code,
                  modifier: [
                    {
                      coding: [
                        {
                          code: '25',
                          system: 'https://terminology.fhir.oystehr.com/CodeSystem/rcm-claim-procedure-modifier',
                        },
                      ],
                    },
                  ],
                  servicedPeriod: {
                    start: expect.any(String),
                    end: undefined,
                  },
                  locationCodeableConcept: undefined,
                  net: {
                    currency: 'USD',
                    value: 0,
                  },
                  quantity: { value: 1, unit: 'UN' },
                },
              ],
            },
          },
        ]),
      });
    });
    it('creates claim with "non-system" billing service', async () => {
      const txFn = vi.fn().mockResolvedValue({
        entry: [
          { resource: { resourceType: 'Patient', id: 'billing-patient' } },
          { resource: { resourceType: 'Patient', id: 'claim-patient' } },
          { resource: { resourceType: 'RelatedPerson', id: 'billing-subscriber' } },
          { resource: { resourceType: 'Coverage', id: 'billing-coverage' } },
          { resource: { resourceType: 'Account', id: 'billing-account' } },
          { resource: { resourceType: 'RelatedPerson', id: 'claim-subscriber' } },
          { resource: { resourceType: 'Coverage', id: 'claim-coverage' } },
          { resource: { resourceType: 'Person', id: 'billing-person' } },
          { resource: { resourceType: 'Basic', id: 'billing-service-basic' } },
          { resource: { resourceType: 'Claim', id: 'claim' } },
          { resource: { resourceType: 'Provenance', id: 'provenance' } },
        ],
      });
      const billingOystehr = {
        fhir: { transaction: txFn },
        rcm: { constructPayerUrl: vi.fn().mockReturnValue('https://rcm-api.zapehr.com/v1/payer/payer-123') },
      } as unknown as Oystehr;
      const cvo: ComplexValidationOutput = {
        clinicalResources: {
          accounts: [clinicalResources.account],
          appointment: {
            ...clinicalResources.appointment,
            serviceCategory: [{ coding: [{ system: SERVICE_CATEGORY_SYSTEM, code: 'shiatsu' }] }],
          },
          billingProvider: clinicalResources.billingProvider,
          coverages: [clinicalResources.coverage],
          diagnoses: [...clinicalResources.conditions],
          encounter: clinicalResources.encounter,
          location: clinicalResources.location,
          patient: clinicalResources.patient,
          payors: [oystehrResources.payor],
          practitioners: [clinicalResources.practitioner],
          procedures: [clinicalResources.procedure],
        },
        billingResources: {
          accounts: [],
          billingProvider: undefined,
          coverages: [],
          mainPatient: undefined,
          person: undefined,
          practitioners: [],
          renderingProvider: undefined,
          serviceFacility: undefined,
          subscribers: [],
        },
      };
      const result = await performEffect(billingOystehr, cvo, TEST_PROVENANCE_AGENT);
      expect(result.claimId).toEqual('claim');
      expect(txFn).toHaveBeenCalledWith({
        requests: expect.arrayContaining([
          {
            method: 'POST',
            url: '/Claim',
            fullUrl: 'urn:uuid:claim',
            resource: {
              resourceType: 'Claim',
              identifier: [
                { system: ottehrIdentifierSystem('claim-encounter-id'), value: 'encounter-123' },
                { system: ottehrIdentifierSystem('claim-appointment-id'), value: 'appointment-123' },
              ],
              status: 'draft',
              meta: {
                tag: [
                  { system: CURRENT_STATUS_TAG_SYSTEM, code: 'open' },
                  { system: CODE_SYSTEM_CLAIM_TYPE, code: CODE_SYSTEM_CLAIM_TYPE_CODES.professional },
                  { system: CODE_SYSTEM_SERVICE_CATEGORY_TAG_SYSTEM, code: 'shiatsu' },
                  { system: CLAIM_STATUS_TAG_SYSTEMS.arStage, code: AR_STAGE.insurancePayer },
                  { system: CLAIM_STATUS_TAG_SYSTEMS.insuranceArStatus, code: 'created' },
                ],
              },
              type: { coding: [{ system: CODE_SYSTEM_CLAIM_TYPE, code: CODE_SYSTEM_CLAIM_TYPE_CODES.professional }] },
              use: 'claim',
              created: expect.any(String),
              extension: getDefaultClaimSubmissionExtensions(),
              patient: {
                reference: 'urn:uuid:claim-patient',
              },
              provider: { display: 'Unknown' },
              facility: undefined,
              insurer: undefined,
              insurance: [buildNoCoverageStub()],
              careTeam: undefined,
              diagnosis: [
                { sequence: 1, diagnosisCodeableConcept: clinicalResources.conditions[0].code },
                { sequence: 2, diagnosisCodeableConcept: clinicalResources.conditions[1].code },
              ],
              priority: { coding: [{ system: CODE_SYSTEM_PROCESS_PRIORITY, code: 'normal' }] },
              total: {
                currency: 'USD',
                value: 0,
              },
              item: [
                {
                  sequence: 1,
                  careTeamSequence: undefined,
                  diagnosisSequence: [1],
                  productOrService: clinicalResources.procedure.code,
                  modifier: [
                    {
                      coding: [
                        {
                          code: '25',
                          system: 'https://terminology.fhir.oystehr.com/CodeSystem/rcm-claim-procedure-modifier',
                        },
                      ],
                    },
                  ],
                  servicedPeriod: {
                    start: expect.any(String),
                    end: undefined,
                  },
                  locationCodeableConcept: undefined,
                  net: {
                    currency: 'USD',
                    value: 0,
                  },
                  quantity: { value: 1, unit: 'UN' },
                },
              ],
            },
          },
        ]),
      });
    });
    it('creates claim with auto accident tag, creating the tag along the way', async () => {
      const txFn = vi.fn().mockResolvedValue({
        entry: [
          { resource: { resourceType: 'Patient', id: 'billing-patient' } },
          { resource: { resourceType: 'Patient', id: 'claim-patient' } },
          { resource: { resourceType: 'RelatedPerson', id: 'billing-subscriber' } },
          { resource: { resourceType: 'Coverage', id: 'billing-coverage' } },
          { resource: { resourceType: 'Account', id: 'billing-account' } },
          { resource: { resourceType: 'RelatedPerson', id: 'claim-subscriber' } },
          { resource: { resourceType: 'Coverage', id: 'claim-coverage' } },
          { resource: { resourceType: 'Person', id: 'billing-person' } },
          { resource: { resourceType: 'Basic', id: 'auto-accident-tag' } },
          { resource: { resourceType: 'Basic', id: 'billing-service-basic' } },
          { resource: { resourceType: 'Claim', id: 'claim' } },
          { resource: { resourceType: 'Provenance', id: 'provenance' } },
        ],
      });
      const billingOystehr = {
        fhir: { transaction: txFn },
        rcm: { constructPayerUrl: vi.fn().mockReturnValue('https://rcm-api.zapehr.com/v1/payer/payer-123') },
      } as unknown as Oystehr;
      const cvo: ComplexValidationOutput = {
        clinicalResources: {
          accounts: [clinicalResources.account],
          appointment: {
            ...clinicalResources.appointment,
            description: 'Auto accident',
          },
          billingProvider: clinicalResources.billingProvider,
          coverages: [clinicalResources.coverage],
          diagnoses: [...clinicalResources.conditions],
          encounter: clinicalResources.encounter,
          location: clinicalResources.location,
          patient: clinicalResources.patient,
          payors: [oystehrResources.payor],
          practitioners: [clinicalResources.practitioner],
          procedures: [clinicalResources.procedure],
        },
        billingResources: {
          accounts: [],
          billingProvider: undefined,
          coverages: [],
          mainPatient: undefined,
          person: undefined,
          practitioners: [],
          renderingProvider: undefined,
          serviceFacility: undefined,
          subscribers: [],
        },
      };
      const result = await performEffect(billingOystehr, cvo, TEST_PROVENANCE_AGENT);
      expect(result.claimId).toEqual('claim');
      expect(txFn).toHaveBeenCalledWith({
        requests: expect.arrayContaining([
          {
            method: 'POST',
            url: '/Claim',
            fullUrl: 'urn:uuid:claim',
            resource: {
              resourceType: 'Claim',
              identifier: [
                { system: ottehrIdentifierSystem('claim-encounter-id'), value: 'encounter-123' },
                { system: ottehrIdentifierSystem('claim-appointment-id'), value: 'appointment-123' },
              ],
              status: 'draft',
              meta: {
                tag: [
                  { system: CURRENT_STATUS_TAG_SYSTEM, code: 'open' },
                  { system: CODE_SYSTEM_CLAIM_TYPE, code: CODE_SYSTEM_CLAIM_TYPE_CODES.professional },
                  { system: CODE_SYSTEM_SERVICE_CATEGORY_TAG_SYSTEM, code: 'urgent-care' },
                  { system: CLAIM_TAG_SYSTEM, code: AUTO_ACCIDENT_TAG_NAME },
                  { system: CLAIM_STATUS_TAG_SYSTEMS.arStage, code: AR_STAGE.insurancePayer },
                  { system: CLAIM_STATUS_TAG_SYSTEMS.insuranceArStatus, code: 'created' },
                ],
              },
              type: { coding: [{ system: CODE_SYSTEM_CLAIM_TYPE, code: CODE_SYSTEM_CLAIM_TYPE_CODES.professional }] },
              use: 'claim',
              created: expect.any(String),
              extension: getDefaultClaimSubmissionExtensions(),
              patient: {
                reference: 'urn:uuid:claim-patient',
              },
              provider: { display: 'Unknown' },
              facility: undefined,
              insurance: [
                {
                  coverage: { reference: 'urn:uuid:claim-coverage-billing-coverage-coverage-123' },
                  focal: true,
                  sequence: 1,
                },
              ],
              insurer: {
                reference: 'https://rcm-api.zapehr.com/v1/payer/payer-123',
              },
              careTeam: undefined,
              diagnosis: [
                { sequence: 1, diagnosisCodeableConcept: clinicalResources.conditions[0].code },
                { sequence: 2, diagnosisCodeableConcept: clinicalResources.conditions[1].code },
              ],
              priority: { coding: [{ system: CODE_SYSTEM_PROCESS_PRIORITY, code: 'normal' }] },
              total: {
                currency: 'USD',
                value: 0,
              },
              item: [
                {
                  sequence: 1,
                  careTeamSequence: undefined,
                  diagnosisSequence: [1],
                  productOrService: clinicalResources.procedure.code,
                  modifier: [
                    {
                      coding: [
                        {
                          code: '25',
                          system: 'https://terminology.fhir.oystehr.com/CodeSystem/rcm-claim-procedure-modifier',
                        },
                      ],
                    },
                  ],
                  servicedPeriod: {
                    start: expect.any(String),
                    end: undefined,
                  },
                  locationCodeableConcept: undefined,
                  net: {
                    currency: 'USD',
                    value: 0,
                  },
                  quantity: { value: 1, unit: 'UN' },
                },
              ],
            },
          },
        ]),
      });
    });
    it('calculates service line amounts and total based on charge master and procedure', async () => {
      const txFn = vi.fn().mockResolvedValue({
        entry: [
          { resource: { resourceType: 'Patient', id: 'billing-patient' } },
          { resource: { resourceType: 'Patient', id: 'claim-patient' } },
          { resource: { resourceType: 'RelatedPerson', id: 'claim-subscriber' } },
          { resource: { resourceType: 'Coverage', id: 'claim-coverage' } },
          { resource: { resourceType: 'Person', id: 'billing-person' } },
          { resource: { resourceType: 'Practitioner', id: 'claim-rendering-provider' } },
          { resource: { resourceType: 'Organization', id: 'claim-billing-provider' } },
          { resource: { resourceType: 'Location', id: 'claim-service-facility' } },
          { resource: { resourceType: 'Claim', id: 'claim' } },
          { resource: { resourceType: 'Provenance', id: 'provenance' } },
        ],
      });
      const billingOystehr = {
        fhir: { transaction: txFn },
        rcm: { constructPayerUrl: vi.fn().mockReturnValue('https://rcm-api.zapehr.com/v1/payer/payer-123') },
      } as unknown as Oystehr;
      const cvo: ComplexValidationOutput = {
        clinicalResources: {
          accounts: [clinicalResources.account],
          appointment: clinicalResources.appointment,
          billingProvider: clinicalResources.billingProvider,
          coverages: [clinicalResources.coverage],
          diagnoses: [...clinicalResources.conditions],
          encounter: clinicalResources.encounter,
          location: clinicalResources.location,
          patient: clinicalResources.patient,
          payors: [oystehrResources.payor],
          practitioners: [clinicalResources.practitioner],
          procedures: [clinicalResources.procedure],
        },
        billingResources: {
          accounts: [billingResources.account],
          billingProvider: billingResources.billingProvider,
          coverages: [billingResources.coverage],
          mainPatient: billingResources.patient,
          person: billingResources.person,
          practitioners: [billingResources.practitioner],
          renderingProvider: billingResources.practitioner,
          serviceFacility: billingResources.location,
          subscribers: [billingResources.relatedPerson],
          billingService: billingResources.billingService,
          chargeMaster: billingResources.chargeMasterInsurance,
        },
      };
      let result = await performEffect(billingOystehr, cvo, TEST_PROVENANCE_AGENT);
      expect(result.claimId).toEqual('claim');
      expect(txFn).toHaveBeenCalledWith({
        requests: expect.arrayContaining([
          {
            method: 'POST',
            url: '/Claim',
            fullUrl: 'urn:uuid:claim',
            resource: {
              resourceType: 'Claim',
              identifier: [
                { system: ottehrIdentifierSystem('claim-encounter-id'), value: 'encounter-123' },
                { system: ottehrIdentifierSystem('claim-appointment-id'), value: 'appointment-123' },
              ],
              status: 'draft',
              meta: {
                tag: [
                  { system: CURRENT_STATUS_TAG_SYSTEM, code: 'open' },
                  { system: CODE_SYSTEM_CLAIM_TYPE, code: CODE_SYSTEM_CLAIM_TYPE_CODES.professional },
                  { system: CODE_SYSTEM_SERVICE_CATEGORY_TAG_SYSTEM, code: 'urgent-care' },
                  { system: CLAIM_STATUS_TAG_SYSTEMS.arStage, code: AR_STAGE.insurancePayer },
                  { system: CLAIM_STATUS_TAG_SYSTEMS.insuranceArStatus, code: 'created' },
                ],
              },
              type: { coding: [{ system: CODE_SYSTEM_CLAIM_TYPE, code: CODE_SYSTEM_CLAIM_TYPE_CODES.professional }] },
              use: 'claim',
              created: expect.any(String),
              extension: getDefaultClaimSubmissionExtensions(),
              patient: {
                reference: 'urn:uuid:claim-patient',
              },
              provider: { reference: 'Organization/billing-organization-123' },
              facility: {
                reference: 'Location/billing-location-123',
              },
              insurer: { reference: 'https://rcm-api.zapehr.com/v1/payer/payer-123' },
              insurance: [
                {
                  sequence: 1,
                  focal: true,
                  coverage: { reference: 'urn:uuid:claim-coverage-billing-coverage-123' },
                },
              ],
              careTeam: [
                {
                  provider: { reference: 'Practitioner/billing-practitioner-123' },
                  role: {
                    coding: [
                      {
                        code: '82',
                        system: 'https://terminology.fhir.oystehr.com/CodeSystem/rcm-claim-referring-provider-type',
                      },
                    ],
                  },
                  sequence: 1,
                },
              ],
              diagnosis: [
                { sequence: 1, diagnosisCodeableConcept: clinicalResources.conditions[0].code },
                { sequence: 2, diagnosisCodeableConcept: clinicalResources.conditions[1].code },
              ],
              priority: { coding: [{ system: CODE_SYSTEM_PROCESS_PRIORITY, code: 'normal' }] },
              total: {
                currency: 'USD',
                value: 20,
              },
              item: [
                {
                  sequence: 1,
                  careTeamSequence: [1],
                  diagnosisSequence: [1],
                  productOrService: clinicalResources.procedure.code,
                  modifier: [
                    {
                      coding: [
                        {
                          code: '25',
                          system: 'https://terminology.fhir.oystehr.com/CodeSystem/rcm-claim-procedure-modifier',
                        },
                      ],
                    },
                  ],
                  servicedPeriod: {
                    start: expect.any(String),
                    end: undefined,
                  },
                  locationCodeableConcept: {
                    coding: [
                      {
                        code: '20',
                        system:
                          'http://www.cms.gov/Medicare/Coding/place-of-service-codes/Place_of_Service_Code_Set.html',
                      },
                    ],
                  },
                  net: {
                    currency: 'USD',
                    value: 20,
                  },
                  quantity: { value: 1, unit: 'UN' },
                },
              ],
            },
          },
        ]),
      });

      // The self-pay charge master does not have an entry with the procedure's code+modifier
      cvo.billingResources.chargeMaster = billingResources.chargeMasterSelfPay;
      result = await performEffect(billingOystehr, cvo, TEST_PROVENANCE_AGENT);
      expect(result.claimId).toEqual('claim');
      expect(txFn).toHaveBeenCalledWith({
        requests: expect.arrayContaining([
          {
            method: 'POST',
            url: '/Claim',
            fullUrl: 'urn:uuid:claim',
            resource: {
              resourceType: 'Claim',
              identifier: [
                { system: ottehrIdentifierSystem('claim-encounter-id'), value: 'encounter-123' },
                { system: ottehrIdentifierSystem('claim-appointment-id'), value: 'appointment-123' },
              ],
              status: 'draft',
              meta: {
                tag: [
                  { system: CURRENT_STATUS_TAG_SYSTEM, code: 'open' },
                  { system: CODE_SYSTEM_CLAIM_TYPE, code: CODE_SYSTEM_CLAIM_TYPE_CODES.professional },
                  { system: CODE_SYSTEM_SERVICE_CATEGORY_TAG_SYSTEM, code: 'urgent-care' },
                  { system: CLAIM_STATUS_TAG_SYSTEMS.arStage, code: AR_STAGE.insurancePayer },
                  { system: CLAIM_STATUS_TAG_SYSTEMS.insuranceArStatus, code: 'created' },
                ],
              },
              type: { coding: [{ system: CODE_SYSTEM_CLAIM_TYPE, code: CODE_SYSTEM_CLAIM_TYPE_CODES.professional }] },
              use: 'claim',
              created: expect.any(String),
              extension: getDefaultClaimSubmissionExtensions(),
              patient: {
                reference: 'urn:uuid:claim-patient',
              },
              provider: { reference: 'Organization/billing-organization-123' },
              facility: {
                reference: 'Location/billing-location-123',
              },
              insurer: { reference: 'https://rcm-api.zapehr.com/v1/payer/payer-123' },
              insurance: [
                {
                  sequence: 1,
                  focal: true,
                  coverage: { reference: 'urn:uuid:claim-coverage-billing-coverage-123' },
                },
              ],
              careTeam: [
                {
                  provider: { reference: 'Practitioner/billing-practitioner-123' },
                  role: {
                    coding: [
                      {
                        code: '82',
                        system: 'https://terminology.fhir.oystehr.com/CodeSystem/rcm-claim-referring-provider-type',
                      },
                    ],
                  },
                  sequence: 1,
                },
              ],
              diagnosis: [
                { sequence: 1, diagnosisCodeableConcept: clinicalResources.conditions[0].code },
                { sequence: 2, diagnosisCodeableConcept: clinicalResources.conditions[1].code },
              ],
              priority: { coding: [{ system: CODE_SYSTEM_PROCESS_PRIORITY, code: 'normal' }] },
              total: {
                currency: 'USD',
                value: 0,
              },
              item: [
                {
                  sequence: 1,
                  careTeamSequence: [1],
                  diagnosisSequence: [1],
                  productOrService: clinicalResources.procedure.code,
                  modifier: [
                    {
                      coding: [
                        {
                          code: '25',
                          system: 'https://terminology.fhir.oystehr.com/CodeSystem/rcm-claim-procedure-modifier',
                        },
                      ],
                    },
                  ],
                  servicedPeriod: {
                    start: expect.any(String),
                    end: undefined,
                  },
                  locationCodeableConcept: {
                    coding: [
                      {
                        code: '20',
                        system:
                          'http://www.cms.gov/Medicare/Coding/place-of-service-codes/Place_of_Service_Code_Set.html',
                      },
                    ],
                  },
                  net: {
                    currency: 'USD',
                    value: 0,
                  },
                  quantity: { value: 1, unit: 'UN' },
                },
              ],
            },
          },
        ]),
      });
    });
    it('swaps Oystehr-invalid HCPCS system URL for HL7 system URL', async () => {
      const txFn = vi.fn().mockResolvedValue({
        entry: [
          { resource: { resourceType: 'Patient', id: 'billing-patient' } },
          { resource: { resourceType: 'Patient', id: 'claim-patient' } },
          { resource: { resourceType: 'RelatedPerson', id: 'billing-subscriber' } },
          { resource: { resourceType: 'Coverage', id: 'billing-coverage' } },
          { resource: { resourceType: 'Account', id: 'billing-account' } },
          { resource: { resourceType: 'RelatedPerson', id: 'claim-subscriber' } },
          { resource: { resourceType: 'Coverage', id: 'claim-coverage' } },
          { resource: { resourceType: 'Person', id: 'billing-person' } },
          { resource: { resourceType: 'Basic', id: 'billing-service-basic' } },
          { resource: { resourceType: 'Claim', id: 'claim' } },
          { resource: { resourceType: 'Provenance', id: 'provenance' } },
        ],
      });
      const billingOystehr = {
        fhir: { transaction: txFn },
        rcm: { constructPayerUrl: vi.fn().mockReturnValue('https://rcm-api.zapehr.com/v1/payer/payer-123') },
      } as unknown as Oystehr;
      const cvo: ComplexValidationOutput = {
        clinicalResources: {
          accounts: [clinicalResources.account],
          appointment: clinicalResources.appointment,
          billingProvider: clinicalResources.billingProvider,
          coverages: [clinicalResources.coverage],
          diagnoses: [...clinicalResources.conditions],
          encounter: clinicalResources.encounter,
          location: clinicalResources.location,
          patient: clinicalResources.patient,
          payors: [oystehrResources.payor],
          practitioners: [clinicalResources.practitioner],
          procedures: [
            {
              ...clinicalResources.procedure,
              code: {
                coding: [
                  {
                    system: CODE_SYSTEM_HCPCS,
                    code: '12345',
                  },
                ],
              },
            },
          ],
        },
        billingResources: {
          accounts: [],
          billingProvider: undefined,
          coverages: [],
          mainPatient: undefined,
          person: undefined,
          practitioners: [],
          renderingProvider: undefined,
          serviceFacility: undefined,
          subscribers: [],
          billingService: undefined,
        },
      };
      const result = await performEffect(billingOystehr, cvo, TEST_PROVENANCE_AGENT);
      expect(result.claimId).toEqual('claim');
      expect(txFn).toHaveBeenCalledWith({
        requests: expect.arrayContaining([
          {
            method: 'POST',
            url: '/Claim',
            fullUrl: 'urn:uuid:claim',
            resource: {
              resourceType: 'Claim',
              identifier: [
                { system: ottehrIdentifierSystem('claim-encounter-id'), value: 'encounter-123' },
                { system: ottehrIdentifierSystem('claim-appointment-id'), value: 'appointment-123' },
              ],
              status: 'draft',
              meta: {
                tag: [
                  { system: CURRENT_STATUS_TAG_SYSTEM, code: 'open' },
                  { system: CODE_SYSTEM_CLAIM_TYPE, code: CODE_SYSTEM_CLAIM_TYPE_CODES.professional },
                  { system: CODE_SYSTEM_SERVICE_CATEGORY_TAG_SYSTEM, code: 'urgent-care' },
                  { system: CLAIM_STATUS_TAG_SYSTEMS.arStage, code: AR_STAGE.insurancePayer },
                  { system: CLAIM_STATUS_TAG_SYSTEMS.insuranceArStatus, code: 'created' },
                ],
              },
              type: { coding: [{ system: CODE_SYSTEM_CLAIM_TYPE, code: CODE_SYSTEM_CLAIM_TYPE_CODES.professional }] },
              use: 'claim',
              created: expect.any(String),
              extension: getDefaultClaimSubmissionExtensions(),
              patient: {
                reference: 'urn:uuid:claim-patient',
              },
              provider: { display: 'Unknown' },
              facility: undefined,
              insurer: { reference: 'https://rcm-api.zapehr.com/v1/payer/payer-123' },
              insurance: [
                {
                  sequence: 1,
                  focal: true,
                  coverage: { reference: 'urn:uuid:claim-coverage-billing-coverage-coverage-123' },
                },
              ],
              careTeam: undefined,
              diagnosis: [
                { sequence: 1, diagnosisCodeableConcept: clinicalResources.conditions[0].code },
                { sequence: 2, diagnosisCodeableConcept: clinicalResources.conditions[1].code },
              ],
              priority: { coding: [{ system: CODE_SYSTEM_PROCESS_PRIORITY, code: 'normal' }] },
              total: {
                currency: 'USD',
                value: 0,
              },
              item: [
                {
                  sequence: 1,
                  careTeamSequence: undefined,
                  diagnosisSequence: [1],
                  productOrService: {
                    coding: [
                      {
                        // It has been swapped
                        system: CODE_SYSTEM_HL7_HCPCS,
                        code: '12345',
                      },
                    ],
                  },
                  modifier: undefined,
                  servicedPeriod: {
                    start: expect.any(String),
                    end: undefined,
                  },
                  locationCodeableConcept: undefined,
                  net: {
                    currency: 'USD',
                    value: 0,
                  },
                  quantity: { value: 1, unit: 'UN' },
                },
              ],
            },
          },
        ]),
      });
    });
    it('swaps incorrect ICD-10 system URL for correct ICD-10 system URL', async () => {
      const txFn = vi.fn().mockResolvedValue({
        entry: [
          { resource: { resourceType: 'Patient', id: 'billing-patient' } },
          { resource: { resourceType: 'Patient', id: 'claim-patient' } },
          { resource: { resourceType: 'RelatedPerson', id: 'billing-subscriber' } },
          { resource: { resourceType: 'Coverage', id: 'billing-coverage' } },
          { resource: { resourceType: 'Account', id: 'billing-account' } },
          { resource: { resourceType: 'RelatedPerson', id: 'claim-subscriber' } },
          { resource: { resourceType: 'Coverage', id: 'claim-coverage' } },
          { resource: { resourceType: 'Person', id: 'billing-person' } },
          { resource: { resourceType: 'Basic', id: 'billing-service-basic' } },
          { resource: { resourceType: 'Claim', id: 'claim' } },
          { resource: { resourceType: 'Provenance', id: 'provenance' } },
        ],
      });
      const billingOystehr = {
        fhir: { transaction: txFn },
        rcm: { constructPayerUrl: vi.fn().mockReturnValue('https://rcm-api.zapehr.com/v1/payer/payer-123') },
      } as unknown as Oystehr;
      const cvo: ComplexValidationOutput = {
        clinicalResources: {
          accounts: [clinicalResources.account],
          appointment: clinicalResources.appointment,
          billingProvider: clinicalResources.billingProvider,
          coverages: [clinicalResources.coverage],
          diagnoses: [
            clinicalResources.conditions[0],
            {
              ...clinicalResources.conditions[1],
              code: {
                coding: [
                  {
                    // Incorrect system
                    system: CODE_SYSTEM_ICD_10,
                    code: 'S06.1XAS',
                    display: 'Traumatic cerebral edema with loss of consciousness status unknown, sequela',
                  },
                ],
              },
            },
          ],
          encounter: clinicalResources.encounter,
          location: clinicalResources.location,
          patient: clinicalResources.patient,
          payors: [oystehrResources.payor],
          practitioners: [clinicalResources.practitioner],
          procedures: [clinicalResources.procedure],
        },
        billingResources: {
          accounts: [],
          billingProvider: undefined,
          coverages: [],
          mainPatient: undefined,
          person: undefined,
          practitioners: [],
          renderingProvider: undefined,
          serviceFacility: undefined,
          subscribers: [],
          billingService: undefined,
        },
      };
      const result = await performEffect(billingOystehr, cvo, TEST_PROVENANCE_AGENT);
      expect(result.claimId).toEqual('claim');
      expect(txFn).toHaveBeenCalledWith({
        requests: expect.arrayContaining([
          {
            method: 'POST',
            url: '/Claim',
            fullUrl: 'urn:uuid:claim',
            resource: {
              resourceType: 'Claim',
              identifier: [
                { system: ottehrIdentifierSystem('claim-encounter-id'), value: 'encounter-123' },
                { system: ottehrIdentifierSystem('claim-appointment-id'), value: 'appointment-123' },
              ],
              status: 'draft',
              meta: {
                tag: [
                  { system: CURRENT_STATUS_TAG_SYSTEM, code: 'open' },
                  { system: CODE_SYSTEM_CLAIM_TYPE, code: CODE_SYSTEM_CLAIM_TYPE_CODES.professional },
                  { system: CODE_SYSTEM_SERVICE_CATEGORY_TAG_SYSTEM, code: 'urgent-care' },
                  { system: CLAIM_STATUS_TAG_SYSTEMS.arStage, code: AR_STAGE.insurancePayer },
                  { system: CLAIM_STATUS_TAG_SYSTEMS.insuranceArStatus, code: 'created' },
                ],
              },
              type: { coding: [{ system: CODE_SYSTEM_CLAIM_TYPE, code: CODE_SYSTEM_CLAIM_TYPE_CODES.professional }] },
              use: 'claim',
              created: expect.any(String),
              extension: getDefaultClaimSubmissionExtensions(),
              patient: {
                reference: 'urn:uuid:claim-patient',
              },
              provider: { display: 'Unknown' },
              facility: undefined,
              insurer: { reference: 'https://rcm-api.zapehr.com/v1/payer/payer-123' },
              insurance: [
                {
                  sequence: 1,
                  focal: true,
                  coverage: { reference: 'urn:uuid:claim-coverage-billing-coverage-coverage-123' },
                },
              ],
              careTeam: undefined,
              diagnosis: [
                { sequence: 1, diagnosisCodeableConcept: clinicalResources.conditions[0].code },
                // Corrected system
                { sequence: 2, diagnosisCodeableConcept: clinicalResources.conditions[1].code },
              ],
              priority: { coding: [{ system: CODE_SYSTEM_PROCESS_PRIORITY, code: 'normal' }] },
              total: {
                currency: 'USD',
                value: 0,
              },
              item: [
                {
                  sequence: 1,
                  careTeamSequence: undefined,
                  diagnosisSequence: [1],
                  productOrService: {
                    coding: [
                      {
                        system: CODE_SYSTEM_CPT,
                        code: '12345',
                        extension: [
                          {
                            url: 'https://fhir.ottehr.com/Extension/cpt-code-modifier',
                            valueCodeableConcept: {
                              coding: [
                                {
                                  code: '25',
                                  system: 'https://fhir.ottehr.com/CodeSystem/cpt-code-modifier',
                                },
                              ],
                            },
                          },
                        ],
                      },
                    ],
                  },
                  modifier: [
                    {
                      coding: [
                        {
                          code: '25',
                          system: 'https://terminology.fhir.oystehr.com/CodeSystem/rcm-claim-procedure-modifier',
                        },
                      ],
                    },
                  ],
                  servicedPeriod: {
                    start: expect.any(String),
                    end: undefined,
                  },
                  locationCodeableConcept: undefined,
                  net: {
                    currency: 'USD',
                    value: 0,
                  },
                  quantity: { value: 1, unit: 'UN' },
                },
              ],
            },
          },
        ]),
      });
    });
  });
});
