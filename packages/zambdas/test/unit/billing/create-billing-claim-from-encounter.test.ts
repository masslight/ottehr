import Oystehr from '@oystehr/sdk';
import {
  Account,
  Appointment,
  Condition,
  Coverage,
  Encounter,
  Location,
  Organization,
  Patient,
  Practitioner,
  Procedure,
} from 'fhir/r4b';
import {
  APIError,
  FHIR_RESOURCE_NOT_FOUND,
  INVALID_INPUT_ERROR,
  MISSING_REQUEST_BODY,
  MISSING_REQUEST_SECRETS,
} from 'utils';
import { ottehrIdentifierSystem } from 'utils/lib/fhir/systemUrls';
import { Mock, vi } from 'vitest';
import {
  complexValidation,
  ComplexValidationOutput,
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
    location: [
      {
        location: {
          reference: 'Location/location-123',
        },
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
  },
  location: {
    resourceType: 'Location',
    id: 'location-123',
  },
  practitioner: {
    resourceType: 'Practitioner',
    id: 'practitioner-123',
  },
  account: {
    resourceType: 'Account',
    id: 'account-123',
    status: 'active',
  },
  coverage: {
    resourceType: 'Coverage',
    id: 'coverage-123',
    payor: [{ reference: 'https://rcm-api.zapehr.com/v1/payer/payer-123' }],
    status: 'active',
    beneficiary: { reference: 'Patient/patient-123' },
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
  },
  billingProvider: {
    resourceType: 'Organization',
    id: 'organization-123',
  },
} as const;

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
        name: 'throws error when coverage does not exist',
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
        expectedError: FHIR_RESOURCE_NOT_FOUND('Coverage'),
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
            clinicalResources.coverage,
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
            clinicalResources.coverage,
            clinicalResources.condition,
          ],
        }),
        billingOystehrSearch: vi.fn().mockResolvedValueOnce({
          unbundle: () => [],
        }),
        expectedError: FHIR_RESOURCE_NOT_FOUND('Procedure'),
      },
      {
        name: 'throws error when coverage does not have payor',
        clinicalOystehrSearch: vi.fn().mockResolvedValueOnce({
          unbundle: () => [
            clinicalResources.encounter,
            clinicalResources.patient,
            clinicalResources.appointment,
            clinicalResources.location,
            clinicalResources.practitioner,
            clinicalResources.account,
            {
              ...clinicalResources.coverage,
              payor: undefined,
            },
            clinicalResources.condition,
            clinicalResources.procedure,
          ],
        }),
        billingOystehrSearch: vi.fn().mockResolvedValueOnce({
          unbundle: () => [],
        }),
        expectedError: FHIR_RESOURCE_NOT_FOUND('Organization'),
      },
      {
        name: 'throws error when billing provider not in secrets',
        clinicalOystehrSearch: vi.fn().mockResolvedValueOnce({
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
            unbundle: () => [],
          }),
        billingOystehrSearch: vi.fn().mockResolvedValueOnce({
          unbundle: () => [],
        }),
        secrets: { DEFAULT_BILLING_PROVIDER: 'Organization/organization-123' },
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
        secrets: { DEFAULT_BILLING_PROVIDER: 'Organization/organization-123' },
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
});
