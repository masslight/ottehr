import Oystehr, { BatchInputPostRequest } from '@oystehr/sdk';
import {
  Account,
  Appointment,
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
  CODE_SYSTEM_CLAIM_TYPE,
  CODE_SYSTEM_CMS_PLACE_OF_SERVICE,
  CODE_SYSTEM_CPT,
  CODE_SYSTEM_CPT_MODIFIER,
  CODE_SYSTEM_PROCESS_PRIORITY,
  EXTENSION_URL_CPT_MODIFIER,
  FHIR_IDENTIFIER_NPI,
  FHIR_RESOURCE_NOT_FOUND,
  INVALID_INPUT_ERROR,
  MISSING_REQUEST_BODY,
  MISSING_REQUEST_SECRETS,
  PARTICIPATION_CODE_SYSTEM,
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
  validateRequestParameters,
} from '../../../src/billing/create-billing-claim-from-encounter/handler';

const clinicalResources: {
  encounter: Encounter;
  patient: Patient;
  appointment: Appointment;
  location: Location;
  practitioner: Practitioner;
  account: Account;
  coverage: Coverage;
  condition: Condition;
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
    period: {
      start: '2026-01-01',
    },
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
    contained: [
      {
        resourceType: 'RelatedPerson',
        id: 'subscriber',
        patient: { reference: 'Patient/patient-123' },
      },
    ],
  },
  condition: {
    resourceType: 'Condition',
    id: 'condition-123',
    subject: {
      reference: 'Patient/patient-123',
    },
  },
  procedure: {
    resourceType: 'Procedure',
    id: 'procedure-123',
    status: 'completed',
    subject: {
      reference: 'Patient/patient-123',
    },
    code: { coding: [{ system: CODE_SYSTEM_CPT, code: '12345' }] },
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
} = {
  person: {
    resourceType: 'Person',
    id: 'billing-person-123',
  },
  patient: {
    resourceType: 'Patient',
    id: 'billing-patient-123',
    extension: [
      { url: 'https://ottehr.com/billing/source-resource', valueReference: { reference: 'Patient/patient-123' } },
    ],
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
      { url: 'https://ottehr.com/billing/source-resource', valueReference: { reference: 'Account/account-123' } },
    ],
  },
  coverage: {
    resourceType: 'Coverage',
    id: 'billing-coverage-123',
    payor: [{ reference: 'https://rcm-api.zapehr.com/v1/payer/payer-123' }],
    status: 'active',
    beneficiary: { reference: 'Patient/billing-patient-123' },
    subscriber: { reference: 'RelatedPerson/billing-related-person-123' },
    extension: [
      { url: 'https://ottehr.com/billing/source-resource', valueReference: { reference: 'Coverage/coverage-123' } },
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
};

const oystehrResources: { payor: Organization } = {
  payor: { resourceType: 'Organization', id: 'payer-123' },
};

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
        expect.objectContaining(INVALID_INPUT_ERROR('Request body is not valid JSON'))
      );
    });
    it('throws validation error on missing encounter id', async () => {
      expect(() => validateRequestParameters({ headers: null, body: '{}', secrets: {} })).toThrow(
        expect.objectContaining(INVALID_INPUT_ERROR('encounterId: Required'))
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
            clinicalResources.condition,
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
              clinicalResources.condition,
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
              clinicalResources.condition,
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
              clinicalResources.condition,
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
              clinicalResources.condition,
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
              clinicalResources.condition,
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
          }),
        secrets: { DEFAULT_BILLING_RESOURCE: 'Organization/organization-123' },
        expectedError: null,
        expectedResult: {
          clinicalResources: {
            accounts: [clinicalResources.account],
            appointment: clinicalResources.appointment,
            billingProvider: clinicalResources.billingProvider,
            coverages: [clinicalResources.coverage],
            diagnoses: [clinicalResources.condition],
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
              clinicalResources.condition,
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
            unbundle: () => [
              billingResources.person,
              billingResources.patient,
              billingResources.account,
              billingResources.coverage,
              billingResources.relatedPerson,
            ],
          })
          .mockResolvedValueOnce({
            unbundle: () => [billingResources.location],
          })
          .mockResolvedValueOnce({
            unbundle: () => [billingResources.practitioner],
          })
          .mockResolvedValueOnce({
            unbundle: () => [billingResources.billingProvider],
          }),
        secrets: { DEFAULT_BILLING_RESOURCE: 'Organization/organization-123' },
        expectedError: null,
        expectedResult: {
          clinicalResources: {
            accounts: [clinicalResources.account],
            appointment: clinicalResources.appointment,
            billingProvider: clinicalResources.billingProvider,
            coverages: [clinicalResources.coverage],
            diagnoses: [clinicalResources.condition],
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
                  "url": "https://ottehr.com/billing/source-resource",
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
                  "url": "https://ottehr.com/billing/source-resource",
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
                    "system": "https://ottehr.com/billing/resource-type",
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
                  "url": "https://ottehr.com/billing/source-resource",
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
                    "system": "https://ottehr.com/billing/resource-type",
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
                  "url": "https://ottehr.com/billing/source-resource",
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
                    "system": "https://ottehr.com/billing/resource-type",
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
                  "url": "https://ottehr.com/billing/source-resource",
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
                    "system": "https://ottehr.com/billing/resource-type",
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
            },
            "url": "/Coverage",
          },
        ]
      `);
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
      const coverageRefs = getClaimCoveragesForEncounter('uc', [billingResources.account], coverages);
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
      const coverageRefs = getClaimCoveragesForEncounter('uc', [accountCopy], claimCoverages);
      expect(coverageRefs).toHaveLength(1);
      expect(coverageRefs[0].coverageRef.reference).toEqual(claimCoverages[0].id);
      expect(coverageRefs[0].payorRef).toEqual(claimCoverages[0].payor[0]);
    });
  });

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
          { resource: { resourceType: 'Claim', id: 'claim' } },
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
          diagnoses: [clinicalResources.condition],
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
      const result = await performEffect(billingOystehr, cvo);
      expect(result.claimId).toEqual('claim');
      expect(txFn).toHaveBeenCalledWith({
        requests: expect.arrayContaining([
          {
            method: 'POST',
            url: '/Claim',
            resource: {
              resourceType: 'Claim',
              status: 'draft',
              meta: {
                tag: [{ system: 'current-status', code: 'open' }],
              },
              type: { coding: [{ system: CODE_SYSTEM_CLAIM_TYPE, code: 'professional' }] },
              use: 'claim',
              created: expect.any(String),
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
              diagnosis: [{ sequence: 1, diagnosisCodeableConcept: clinicalResources.condition.code }],
              priority: { coding: [{ system: CODE_SYSTEM_PROCESS_PRIORITY, code: 'normal' }] },
              total: undefined,
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
                  net: undefined,
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
          { resource: { resourceType: 'Patient', id: 'claim-patient' } },
          { resource: { resourceType: 'RelatedPerson', id: 'claim-subscriber' } },
          { resource: { resourceType: 'Coverage', id: 'claim-coverage' } },
          { resource: { resourceType: 'Person', id: 'billing-person' } },
          { resource: { resourceType: 'Claim', id: 'claim' } },
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
          diagnoses: [clinicalResources.condition],
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
        },
      };
      const result = await performEffect(billingOystehr, cvo);
      expect(result.claimId).toEqual('claim');
      expect(txFn).toHaveBeenCalledWith({
        requests: expect.arrayContaining([
          {
            method: 'POST',
            url: '/Claim',
            resource: {
              resourceType: 'Claim',
              status: 'draft',
              meta: {
                tag: [{ system: 'current-status', code: 'open' }],
              },
              type: { coding: [{ system: CODE_SYSTEM_CLAIM_TYPE, code: 'professional' }] },
              use: 'claim',
              created: expect.any(String),
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
                      { code: '82', system: 'https://terminology.zapehr.com/rcm/cms1500/referring-provider-type' },
                    ],
                  },
                  sequence: 1,
                },
              ],
              diagnosis: [{ sequence: 1, diagnosisCodeableConcept: clinicalResources.condition.code }],
              priority: { coding: [{ system: CODE_SYSTEM_PROCESS_PRIORITY, code: 'normal' }] },
              total: undefined,
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
                  net: undefined,
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
