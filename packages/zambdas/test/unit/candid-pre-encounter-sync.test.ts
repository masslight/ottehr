import { ENCOUNTER_PAYMENT_VARIANT_EXTENSION_URL, PaymentVariant, SERVICE_CATEGORY_SYSTEM } from 'utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';
// ── Imports ────────────────────────────────────────────────────────────────────
// src/ehr/shared/harvest (and src/shared/chart-data) are mocked suite-wide in
// vitest.unit-mocks.setup.ts; performCandidPreEncounterSync delegates to the real
// implementation, which is what this file tests.
import { performCandidPreEncounterSync } from '../../src/shared/candid';

// IMPORTANT: harvest must be imported AFTER candid. The real harvest module imports the
// src/shared barrel (which re-exports candid), so if the harvest mock factory executes
// first, vitest's mock-cycle guard hands the real candid module the RAW harvest module and
// the vi.mocked(getAccountAndCoverageResourcesForPatient) overrides below go dead. A
// dynamic import keeps this ordering safe from lint import sorting.
const { getAccountAndCoverageResourcesForPatient } = await import('../../src/ehr/shared/harvest');

// ── Mock helpers ───────────────────────────────────────────────────────────────

const PATIENT_ID = 'patient-abc';
const ENCOUNTER_ID = 'encounter-123';
const CANDID_PATIENT_ID = 'candid-patient-xyz';
const CANDID_APPOINTMENT_ID = 'candid-appt-456';

function makeMockOystehr(options?: { paymentVariant?: PaymentVariant; serviceCategory?: string }): any {
  const encounterExtensions = options?.paymentVariant
    ? [{ url: ENCOUNTER_PAYMENT_VARIANT_EXTENSION_URL, valueString: options.paymentVariant }]
    : undefined;

  const appointmentServiceCategory = options?.serviceCategory
    ? [{ coding: [{ system: SERVICE_CATEGORY_SYSTEM, code: options.serviceCategory }] }]
    : undefined;

  return {
    fhir: {
      search: vi.fn().mockReturnValue({
        unbundle: () => [
          {
            resourceType: 'Patient',
            id: PATIENT_ID,
            name: [{ given: ['Test'], family: 'Patient' }],
            birthDate: '1990-01-01',
            gender: 'male',
            address: [
              {
                use: 'home',
                line: ['123 Main St'],
                city: 'Anytown',
                state: 'CA',
                postalCode: '90210',
              },
            ],
            telecom: [{ system: 'phone', value: '555-0100' }],
          },
          {
            resourceType: 'Appointment',
            id: 'appt-1',
            status: 'fulfilled',
            start: '2026-04-22T10:00:00Z',
            participant: [],
            serviceCategory: appointmentServiceCategory,
          },
          {
            resourceType: 'Encounter',
            id: ENCOUNTER_ID,
            status: 'finished',
            extension: encounterExtensions,
          },
        ],
      }),
      patch: vi.fn(),
    },
  };
}

function makeMockCandidApiClient(): any {
  return {
    preEncounter: {
      patients: {
        v1: {
          getMulti: vi.fn().mockResolvedValue({
            ok: false,
            body: { items: [] },
          }),
          createWithMrn: vi.fn().mockResolvedValue({
            ok: true,
            body: {
              id: CANDID_PATIENT_ID,
              version: 1,
              filingOrder: { coverages: [] },
            },
          }),
          update: vi.fn().mockResolvedValue({
            ok: true,
            body: {
              id: CANDID_PATIENT_ID,
              version: 2,
              filingOrder: { coverages: [] },
            },
          }),
        },
      },
      appointments: {
        v1: {
          create: vi.fn().mockResolvedValue({
            ok: true,
            body: { id: CANDID_APPOINTMENT_ID },
          }),
          get: vi.fn().mockResolvedValue({
            ok: true,
            body: { id: CANDID_APPOINTMENT_ID },
          }),
        },
      },
      coverages: {
        v1: {
          create: vi.fn().mockResolvedValue({
            ok: true,
            body: { id: 'coverage-1' },
          }),
        },
      },
    },
    patientPayments: {
      v4: {
        create: vi.fn().mockResolvedValue({ ok: true }),
      },
    },
  };
}

// ── Tests ──────────────────────────────────────────────────────────────────────

describe('performCandidPreEncounterSync – amountCents guard (real implementation)', () => {
  let mockOystehr: ReturnType<typeof makeMockOystehr>;
  let mockCandidApiClient: ReturnType<typeof makeMockCandidApiClient>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockOystehr = makeMockOystehr();
    mockCandidApiClient = makeMockCandidApiClient();

    vi.mocked(getAccountAndCoverageResourcesForPatient).mockResolvedValue({
      coverages: {},
      insuranceOrgs: [],
      occupationalMedicineAccount: undefined,
    } as any);
  });

  it('calls patientPayments.v4.create when amountCents > 0', async () => {
    await performCandidPreEncounterSync({
      encounterId: ENCOUNTER_ID,
      oystehr: mockOystehr,
      candidApiClient: mockCandidApiClient,
      amountCents: 2500,
    });

    expect(mockCandidApiClient.patientPayments.v4.create).toHaveBeenCalledOnce();
    expect(mockCandidApiClient.patientPayments.v4.create).toHaveBeenCalledWith(
      expect.objectContaining({ amountCents: 2500 })
    );
  });

  it('does NOT call patientPayments.v4.create when amountCents is undefined', async () => {
    await performCandidPreEncounterSync({
      encounterId: ENCOUNTER_ID,
      oystehr: mockOystehr,
      candidApiClient: mockCandidApiClient,
      amountCents: undefined,
    });

    expect(mockCandidApiClient.patientPayments.v4.create).not.toHaveBeenCalled();
  });

  it('does NOT call patientPayments.v4.create when amountCents is 0', async () => {
    await performCandidPreEncounterSync({
      encounterId: ENCOUNTER_ID,
      oystehr: mockOystehr,
      candidApiClient: mockCandidApiClient,
      amountCents: 0,
    });

    expect(mockCandidApiClient.patientPayments.v4.create).not.toHaveBeenCalled();
  });

  it('does NOT call patientPayments.v4.create when amountCents is omitted', async () => {
    await performCandidPreEncounterSync({
      encounterId: ENCOUNTER_ID,
      oystehr: mockOystehr,
      candidApiClient: mockCandidApiClient,
    });

    expect(mockCandidApiClient.patientPayments.v4.create).not.toHaveBeenCalled();
  });

  it('still creates Candid patient and appointment even when amountCents is undefined', async () => {
    await performCandidPreEncounterSync({
      encounterId: ENCOUNTER_ID,
      oystehr: mockOystehr,
      candidApiClient: mockCandidApiClient,
      amountCents: undefined,
    });

    // Patient was fetched (not found) then created
    expect(mockCandidApiClient.preEncounter.patients.v1.getMulti).toHaveBeenCalled();
    expect(mockCandidApiClient.preEncounter.patients.v1.createWithMrn).toHaveBeenCalled();
    // Appointment was created
    expect(mockCandidApiClient.preEncounter.appointments.v1.create).toHaveBeenCalled();
  });

  it('passes correct allocation with appointmentId when recording payment', async () => {
    await performCandidPreEncounterSync({
      encounterId: ENCOUNTER_ID,
      oystehr: mockOystehr,
      candidApiClient: mockCandidApiClient,
      amountCents: 5000,
    });

    const createCall = mockCandidApiClient.patientPayments.v4.create.mock.calls[0][0];
    expect(createCall.amountCents).toBe(5000);
    expect(createCall.allocations).toHaveLength(1);
    expect(createCall.allocations[0].amountCents).toBe(5000);
    expect(createCall.allocations[0].target.type).toBe('appointment_by_id_and_patient_external_id');
  });

  it('creates only one Cash Pay coverage for self-pay encounters even when insurance coverages are present', async () => {
    mockOystehr = makeMockOystehr({ paymentVariant: PaymentVariant.selfPay });
    vi.mocked(getAccountAndCoverageResourcesForPatient).mockResolvedValue({
      coverages: {
        primary: {
          payor: [{ reference: 'Organization/org-1' }],
        },
        primarySubscriber: {
          resourceType: 'RelatedPerson',
          id: 'subscriber-1',
        },
      },
      insuranceOrgs: [
        {
          resourceType: 'Organization',
          id: 'org-1',
          name: 'Acme Insurance',
          identifier: [
            {
              system: 'https://identifiers.fhir.oystehr.com/rcm-payer-id',
              value: 'payer-1',
            },
          ],
        },
      ],
      occupationalMedicineAccount: undefined,
    } as any);

    await performCandidPreEncounterSync({
      encounterId: ENCOUNTER_ID,
      oystehr: mockOystehr,
      candidApiClient: mockCandidApiClient,
    });

    expect(mockCandidApiClient.preEncounter.coverages.v1.create).toHaveBeenCalledTimes(1);
    expect(mockCandidApiClient.preEncounter.coverages.v1.create).toHaveBeenCalledWith(
      expect.objectContaining({
        insurancePlan: expect.objectContaining({
          payerName: 'Cash Pay',
          payerId: 'Cash Pay',
        }),
      })
    );
  });

  it('syncs WC insurance (not Cash Pay) for workers-comp visit even when payment variant is selfPay', async () => {
    mockOystehr = makeMockOystehr({ paymentVariant: PaymentVariant.selfPay, serviceCategory: 'workers-comp' });
    vi.mocked(getAccountAndCoverageResourcesForPatient).mockResolvedValue({
      coverages: {
        workersComp: {
          payor: [{ reference: 'Organization/wc-org-1' }],
          subscriberId: 'WC-MEMBER-001',
          relationship: { coding: [{ code: 'other' }] },
        },
      },
      insuranceOrgs: [
        {
          resourceType: 'Organization',
          id: 'wc-org-1',
          name: 'Workers Comp Insurer',
          type: [{ coding: [{ system: 'http://terminology.hl7.org/CodeSystem/organization-type', code: 'pay' }] }],
          identifier: [
            {
              system: 'https://identifiers.fhir.oystehr.com/rcm-payer-id',
              value: 'wc-payer-1',
            },
          ],
        },
      ],
      occupationalMedicineAccount: undefined,
    } as any);

    await performCandidPreEncounterSync({
      encounterId: ENCOUNTER_ID,
      oystehr: mockOystehr,
      candidApiClient: mockCandidApiClient,
    });

    expect(mockCandidApiClient.preEncounter.coverages.v1.create).toHaveBeenCalledTimes(1);
    expect(mockCandidApiClient.preEncounter.coverages.v1.create).not.toHaveBeenCalledWith(
      expect.objectContaining({
        insurancePlan: expect.objectContaining({ payerName: 'Cash Pay' }),
      })
    );
    expect(mockCandidApiClient.preEncounter.coverages.v1.create).toHaveBeenCalledWith(
      expect.objectContaining({
        insurancePlan: expect.objectContaining({ payerName: 'Workers Comp Insurer' }),
      })
    );
  });
});
