import { beforeEach, describe, expect, it, vi } from 'vitest';

// ── Mocks (hoisted before imports) ─────────────────────────────────────────────

const mockGetAccountAndCoverageResourcesForPatient = vi.fn();

vi.mock('../../src/ehr/shared/harvest', () => ({
  getAccountAndCoverageResourcesForPatient: (...args: any[]) => mockGetAccountAndCoverageResourcesForPatient(...args),
}));

vi.mock('../../src/shared/chart-data', () => ({
  chartDataResourceHasMetaTagByCode: vi.fn(),
}));

// ── Imports ────────────────────────────────────────────────────────────────────

import { performCandidPreEncounterSync } from '../../src/shared/candid';

// ── Mock helpers ───────────────────────────────────────────────────────────────

const PATIENT_ID = 'patient-abc';
const ENCOUNTER_ID = 'encounter-123';
const CANDID_PATIENT_ID = 'candid-patient-xyz';
const CANDID_APPOINTMENT_ID = 'candid-appt-456';

function makeMockOystehr(): any {
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
          create: vi.fn(),
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

    mockGetAccountAndCoverageResourcesForPatient.mockResolvedValue({
      coverages: {},
      insuranceOrgs: [],
      occupationalMedicineAccount: undefined,
    });
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
});
