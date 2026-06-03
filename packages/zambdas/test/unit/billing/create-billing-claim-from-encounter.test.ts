import Oystehr from '@oystehr/sdk';
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
  validateRequestParameters,
} from '../../../src/billing/create-billing-claim-from-encounter/handler';

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
          unbundle: () => [
            {
              resourceType: 'Encounter',
              id: 'encounter-123',
              subject: {
                reference: 'Patient/patient-123',
              },
            },
          ],
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
            {
              resourceType: 'Encounter',
              id: 'encounter-123',
              subject: {
                reference: 'Patient/patient-123',
              },
            },
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
          unbundle: () => [
            {
              resourceType: 'Encounter',
              id: 'encounter-123',
              subject: {
                reference: 'Patient/patient-123',
              },
              appointment: [
                {
                  reference: 'Appointment/appointment-123',
                },
              ],
            },
            {
              resourceType: 'Patient',
              id: 'patient-123',
            },
          ],
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
            {
              resourceType: 'Encounter',
              id: 'encounter-123',
              subject: {
                reference: 'Patient/patient-123',
              },
              appointment: [
                {
                  reference: 'Appointment/appointment-123',
                },
              ],
            },
            {
              resourceType: 'Patient',
              id: 'patient-123',
            },
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
          unbundle: () => [
            {
              resourceType: 'Encounter',
              id: 'encounter-123',
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
            {
              resourceType: 'Patient',
              id: 'patient-123',
            },
            {
              resourceType: 'Appointment',
              id: 'appointment-123',
            },
          ],
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
            {
              resourceType: 'Encounter',
              id: 'encounter-123',
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
            {
              resourceType: 'Patient',
              id: 'patient-123',
            },
            {
              resourceType: 'Appointment',
              id: 'appointment-123',
            },
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
            {
              resourceType: 'Encounter',
              id: 'encounter-123',
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
            {
              resourceType: 'Patient',
              id: 'patient-123',
            },
            {
              resourceType: 'Appointment',
              id: 'appointment-123',
            },
            {
              resourceType: 'Location',
              id: 'location-123',
            },
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
            {
              resourceType: 'Encounter',
              id: 'encounter-123',
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
            {
              resourceType: 'Patient',
              id: 'patient-123',
            },
            {
              resourceType: 'Appointment',
              id: 'appointment-123',
            },
            {
              resourceType: 'Location',
              id: 'location-123',
            },
            {
              resourceType: 'Practitioner',
              id: 'practitioner-123',
            },
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
            {
              resourceType: 'Encounter',
              id: 'encounter-123',
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
            {
              resourceType: 'Patient',
              id: 'patient-123',
            },
            {
              resourceType: 'Appointment',
              id: 'appointment-123',
            },
            {
              resourceType: 'Location',
              id: 'location-123',
            },
            {
              resourceType: 'Practitioner',
              id: 'practitioner-123',
            },
            {
              resourceType: 'Account',
              id: 'account-123',
            },
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
            {
              resourceType: 'Encounter',
              id: 'encounter-123',
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
            {
              resourceType: 'Patient',
              id: 'patient-123',
            },
            {
              resourceType: 'Appointment',
              id: 'appointment-123',
            },
            {
              resourceType: 'Location',
              id: 'location-123',
            },
            {
              resourceType: 'Practitioner',
              id: 'practitioner-123',
            },
            {
              resourceType: 'Account',
              id: 'account-123',
            },
            {
              resourceType: 'Coverage',
              id: 'coverage-123',
            },
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
            {
              resourceType: 'Encounter',
              id: 'encounter-123',
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
            {
              resourceType: 'Patient',
              id: 'patient-123',
            },
            {
              resourceType: 'Appointment',
              id: 'appointment-123',
            },
            {
              resourceType: 'Location',
              id: 'location-123',
            },
            {
              resourceType: 'Practitioner',
              id: 'practitioner-123',
            },
            {
              resourceType: 'Account',
              id: 'account-123',
            },
            {
              resourceType: 'Coverage',
              id: 'coverage-123',
            },
            {
              resourceType: 'Condition',
              id: 'condition-123',
            },
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
            {
              resourceType: 'Encounter',
              id: 'encounter-123',
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
            {
              resourceType: 'Patient',
              id: 'patient-123',
            },
            {
              resourceType: 'Appointment',
              id: 'appointment-123',
            },
            {
              resourceType: 'Location',
              id: 'location-123',
            },
            {
              resourceType: 'Practitioner',
              id: 'practitioner-123',
            },
            {
              resourceType: 'Account',
              id: 'account-123',
            },
            {
              resourceType: 'Coverage',
              id: 'coverage-123',
            },
            {
              resourceType: 'Condition',
              id: 'condition-123',
            },
            {
              resourceType: 'Procedure',
              id: 'procedure-123',
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
        clinicalOystehrSearch: vi.fn().mockResolvedValueOnce({
          unbundle: () => [
            {
              resourceType: 'Encounter',
              id: 'encounter-123',
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
            {
              resourceType: 'Patient',
              id: 'patient-123',
            },
            {
              resourceType: 'Appointment',
              id: 'appointment-123',
            },
            {
              resourceType: 'Location',
              id: 'location-123',
            },
            {
              resourceType: 'Practitioner',
              id: 'practitioner-123',
            },
            {
              resourceType: 'Account',
              id: 'account-123',
            },
            {
              resourceType: 'Coverage',
              id: 'coverage-123',
              payor: [{ reference: 'https://rcm-api.zapehr.com/v1/payer/payer-123' }],
            },
            {
              resourceType: 'Condition',
              id: 'condition-123',
            },
            {
              resourceType: 'Procedure',
              id: 'procedure-123',
            },
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
              {
                resourceType: 'Encounter',
                id: 'encounter-123',
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
              {
                resourceType: 'Patient',
                id: 'patient-123',
              },
              {
                resourceType: 'Appointment',
                id: 'appointment-123',
              },
              {
                resourceType: 'Location',
                id: 'location-123',
              },
              {
                resourceType: 'Practitioner',
                id: 'practitioner-123',
              },
              {
                resourceType: 'Account',
                id: 'account-123',
              },
              {
                resourceType: 'Coverage',
                id: 'coverage-123',
                payor: [{ reference: 'https://rcm-api.zapehr.com/v1/payer/payer-123' }],
              },
              {
                resourceType: 'Condition',
                id: 'condition-123',
              },
              {
                resourceType: 'Procedure',
                id: 'procedure-123',
              },
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
              {
                resourceType: 'Encounter',
                id: 'encounter-123',
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
              {
                resourceType: 'Patient',
                id: 'patient-123',
              },
              {
                resourceType: 'Appointment',
                id: 'appointment-123',
              },
              {
                resourceType: 'Location',
                id: 'location-123',
              },
              {
                resourceType: 'Practitioner',
                id: 'practitioner-123',
              },
              {
                resourceType: 'Account',
                id: 'account-123',
              },
              {
                resourceType: 'Coverage',
                id: 'coverage-123',
                payor: [{ reference: 'https://rcm-api.zapehr.com/v1/payer/payer-123' }],
              },
              {
                resourceType: 'Condition',
                id: 'condition-123',
              },
              {
                resourceType: 'Procedure',
                id: 'procedure-123',
              },
            ],
          })
          .mockResolvedValueOnce({
            unbundle: () => [
              {
                resourceType: 'Organization',
                id: 'organization-123',
              },
            ],
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
      },
    ];
    it.each(tt)('$name', async (tc) => {
      const expectPromise = expect(
        complexValidation(
          {
            fhir: { search: tc.clinicalOystehrSearch },
            rcm: { getPayerByUrl: vi.fn().mockResolvedValue({ resourceType: 'Organization', id: 'payer-123' }) },
          } as unknown as Oystehr,
          { fhir: { search: tc.billingOystehrSearch } } as unknown as Oystehr,
          { encounterId, secrets: tc.secrets ?? {} }
        )
      );
      if (tc.expectedError) await expectPromise.rejects.toThrow(expect.objectContaining(tc.expectedError));
      else await expectPromise.resolves.toBeDefined();
    });
  });
});
