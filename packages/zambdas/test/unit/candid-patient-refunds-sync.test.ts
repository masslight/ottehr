import { beforeEach, describe, expect, it, vi } from 'vitest';

// ── Mocks (hoisted before imports) ─────────────────────────────────────────────

vi.mock('../../src/ehr/shared/harvest', () => ({
  getAccountAndCoverageResourcesForPatient: vi.fn(),
}));

vi.mock('../../src/shared/chart-data', () => ({
  chartDataResourceHasMetaTagByCode: vi.fn(),
}));

// ── Imports ────────────────────────────────────────────────────────────────────

import { PaymentRefundDTO } from 'utils/lib/types/api/patient-payment-types';
import {
  CANDID_PRE_ENCOUNTER_APPOINTMENT_ID_IDENTIFIER_SYSTEM,
  syncCandidPatientRefunds,
} from '../../src/shared/candid';

// ── Mock helpers ───────────────────────────────────────────────────────────────

const PATIENT_ID = 'patient-abc';
const ENCOUNTER_ID = 'encounter-123';
const CANDID_APPOINTMENT_ID = 'candid-appt-456';

function makeMockOystehr(options?: { withCandidAppointmentId?: boolean }): any {
  const appointmentIdentifier =
    options?.withCandidAppointmentId === false
      ? undefined
      : [{ system: CANDID_PRE_ENCOUNTER_APPOINTMENT_ID_IDENTIFIER_SYSTEM, value: CANDID_APPOINTMENT_ID }];

  return {
    fhir: {
      search: vi.fn().mockReturnValue({
        unbundle: () => [
          { resourceType: 'Patient', id: PATIENT_ID },
          {
            resourceType: 'Appointment',
            id: 'appt-1',
            status: 'fulfilled',
            start: '2026-04-22T10:00:00Z',
            participant: [],
            identifier: appointmentIdentifier,
          },
          { resourceType: 'Encounter', id: ENCOUNTER_ID, status: 'finished' },
        ],
      }),
    },
  };
}

function makeMockCandidApiClient(existingRefunds: { refundNote?: string; patientRefundId?: string }[] = []): any {
  return {
    patientRefunds: {
      v1: {
        getMulti: vi.fn().mockResolvedValue({
          ok: true,
          body: {
            items: existingRefunds.map((item, index) => ({ patientRefundId: `existing-${index}`, ...item })),
          },
        }),
        create: vi.fn().mockResolvedValue({ ok: true, body: { patientRefundId: 'candid-refund-1' } }),
        delete: vi.fn().mockResolvedValue({ ok: true }),
      },
    },
  };
}

function makeRefund(overrides?: Partial<PaymentRefundDTO>): PaymentRefundDTO {
  return {
    stripeRefundId: 'manual_notice-1_key-1',
    amountInCents: 2500,
    dateISO: '2026-04-22T12:00:00Z',
    status: 'succeeded',
    reason: 'Overcharge',
    ...overrides,
  };
}

// ── Tests ──────────────────────────────────────────────────────────────────────

describe('syncCandidPatientRefunds', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('creates a Candid patient refund allocated to the pre-encounter appointment', async () => {
    const candidApiClient = makeMockCandidApiClient();
    const recorded = await syncCandidPatientRefunds({
      encounterId: ENCOUNTER_ID,
      refunds: [makeRefund()],
      oystehr: makeMockOystehr(),
      candidApiClient,
    });

    expect(recorded).toBe(1);
    expect(candidApiClient.patientRefunds.v1.create).toHaveBeenCalledOnce();
    const createArg = candidApiClient.patientRefunds.v1.create.mock.calls[0][0];
    expect(createArg).toMatchObject({
      amountCents: 2500,
      patientExternalId: PATIENT_ID,
      refundReason: 'OVERCHARGED',
      allocations: [
        {
          amountCents: 2500,
          target: {
            type: 'appointment_by_id_and_patient_external_id',
            appointmentId: CANDID_APPOINTMENT_ID,
            patientExternalId: PATIENT_ID,
          },
        },
      ],
    });
    expect(createArg.refundNote).toContain('[ottehr-refund:manual_notice-1_key-1]');
  });

  it('skips refunds already recorded in Candid (note-marker dedup)', async () => {
    const candidApiClient = makeMockCandidApiClient([
      { refundNote: '[ottehr-refund:manual_notice-1_key-1] — Overcharge' },
    ]);
    const recorded = await syncCandidPatientRefunds({
      encounterId: ENCOUNTER_ID,
      refunds: [makeRefund(), makeRefund({ stripeRefundId: 'manual_notice-1_key-2', amountInCents: 1000 })],
      oystehr: makeMockOystehr(),
      candidApiClient,
    });

    expect(recorded).toBe(1);
    expect(candidApiClient.patientRefunds.v1.create).toHaveBeenCalledOnce();
    expect(candidApiClient.patientRefunds.v1.create).toHaveBeenCalledWith(
      expect.objectContaining({ amountCents: 1000 })
    );
  });

  it('falls back to an unattributed allocation when the appointment has no Candid id', async () => {
    const candidApiClient = makeMockCandidApiClient();
    await syncCandidPatientRefunds({
      encounterId: ENCOUNTER_ID,
      refunds: [makeRefund()],
      oystehr: makeMockOystehr({ withCandidAppointmentId: false }),
      candidApiClient,
    });

    expect(candidApiClient.patientRefunds.v1.create).toHaveBeenCalledWith(
      expect.objectContaining({ allocations: [{ amountCents: 2500, target: { type: 'unattributed' } }] })
    );
  });

  it('includes the external refund medium and omits an unmapped reason', async () => {
    const candidApiClient = makeMockCandidApiClient();
    await syncCandidPatientRefunds({
      encounterId: ENCOUNTER_ID,
      refunds: [makeRefund({ reason: 'Other', medium: 'check', notes: 'mailed check #42' })],
      oystehr: makeMockOystehr(),
      candidApiClient,
    });

    const createArg = candidApiClient.patientRefunds.v1.create.mock.calls[0][0];
    expect(createArg.refundReason).toBeUndefined();
    expect(createArg.refundNote).toContain('via check');
    expect(createArg.refundNote).toContain('mailed check #42');
  });

  it('does nothing for an empty refund list', async () => {
    const candidApiClient = makeMockCandidApiClient();
    const oystehr = makeMockOystehr();
    const recorded = await syncCandidPatientRefunds({
      encounterId: ENCOUNTER_ID,
      refunds: [],
      oystehr,
      candidApiClient,
    });

    expect(recorded).toBe(0);
    expect(oystehr.fhir.search).not.toHaveBeenCalled();
    expect(candidApiClient.patientRefunds.v1.getMulti).not.toHaveBeenCalled();
  });

  it('paginates the existing Candid refunds before deduping', async () => {
    const candidApiClient = makeMockCandidApiClient();
    candidApiClient.patientRefunds.v1.getMulti
      .mockResolvedValueOnce({
        ok: true,
        body: { items: [{ refundNote: 'unrelated' }], nextPageToken: 'page-2' },
      })
      .mockResolvedValueOnce({
        ok: true,
        body: { items: [{ refundNote: '[ottehr-refund:manual_notice-1_key-1]' }] },
      });

    const recorded = await syncCandidPatientRefunds({
      encounterId: ENCOUNTER_ID,
      refunds: [makeRefund()],
      oystehr: makeMockOystehr(),
      candidApiClient,
    });

    expect(candidApiClient.patientRefunds.v1.getMulti).toHaveBeenCalledTimes(2);
    expect(recorded).toBe(0);
    expect(candidApiClient.patientRefunds.v1.create).not.toHaveBeenCalled();
  });

  it('throws when the Candid refund create fails', async () => {
    const candidApiClient = makeMockCandidApiClient();
    candidApiClient.patientRefunds.v1.create.mockResolvedValue({ ok: false, error: { errorName: 'boom' } });

    await expect(
      syncCandidPatientRefunds({
        encounterId: ENCOUNTER_ID,
        refunds: [makeRefund()],
        oystehr: makeMockOystehr(),
        candidApiClient,
      })
    ).rejects.toThrow('Error creating Candid patient refund');
  });

  it('re-lists after creating and trims a duplicate created by a concurrent sync', async () => {
    const candidApiClient = makeMockCandidApiClient();
    candidApiClient.patientRefunds.v1.getMulti
      .mockResolvedValueOnce({ ok: true, body: { items: [] } })
      .mockResolvedValueOnce({
        ok: true,
        body: {
          items: [
            { patientRefundId: 'refund-b', refundNote: '[ottehr-refund:manual_notice-1_key-1]' },
            { patientRefundId: 'refund-a', refundNote: '[ottehr-refund:manual_notice-1_key-1]' },
          ],
        },
      });

    const recorded = await syncCandidPatientRefunds({
      encounterId: ENCOUNTER_ID,
      refunds: [makeRefund()],
      oystehr: makeMockOystehr(),
      candidApiClient,
    });

    expect(recorded).toBe(1);
    expect(candidApiClient.patientRefunds.v1.getMulti).toHaveBeenCalledTimes(2);
    // keeps the lowest id so every racer picks the same winner
    expect(candidApiClient.patientRefunds.v1.delete).toHaveBeenCalledOnce();
    expect(candidApiClient.patientRefunds.v1.delete).toHaveBeenCalledWith('refund-b');
  });

  it('trims pre-existing duplicates even when nothing new is created', async () => {
    const candidApiClient = makeMockCandidApiClient([
      { patientRefundId: 'refund-2', refundNote: '[ottehr-refund:manual_notice-1_key-1]' },
      { patientRefundId: 'refund-1', refundNote: '[ottehr-refund:manual_notice-1_key-1]' },
    ]);

    const recorded = await syncCandidPatientRefunds({
      encounterId: ENCOUNTER_ID,
      refunds: [makeRefund()],
      oystehr: makeMockOystehr(),
      candidApiClient,
    });

    expect(recorded).toBe(0);
    expect(candidApiClient.patientRefunds.v1.create).not.toHaveBeenCalled();
    // no re-list needed when nothing was created
    expect(candidApiClient.patientRefunds.v1.getMulti).toHaveBeenCalledOnce();
    expect(candidApiClient.patientRefunds.v1.delete).toHaveBeenCalledWith('refund-2');
  });

  it('tolerates a duplicate already deleted by a concurrent sync', async () => {
    const candidApiClient = makeMockCandidApiClient([
      { patientRefundId: 'refund-2', refundNote: '[ottehr-refund:manual_notice-1_key-1]' },
      { patientRefundId: 'refund-1', refundNote: '[ottehr-refund:manual_notice-1_key-1]' },
    ]);
    candidApiClient.patientRefunds.v1.delete.mockResolvedValue({
      ok: false,
      error: { errorName: 'EntityNotFoundError' },
    });

    await expect(
      syncCandidPatientRefunds({
        encounterId: ENCOUNTER_ID,
        refunds: [makeRefund()],
        oystehr: makeMockOystehr(),
        candidApiClient,
      })
    ).resolves.toBe(0);
  });

  it('throws when deleting a duplicate fails for another reason', async () => {
    const candidApiClient = makeMockCandidApiClient([
      { patientRefundId: 'refund-2', refundNote: '[ottehr-refund:manual_notice-1_key-1]' },
      { patientRefundId: 'refund-1', refundNote: '[ottehr-refund:manual_notice-1_key-1]' },
    ]);
    candidApiClient.patientRefunds.v1.delete.mockResolvedValue({
      ok: false,
      error: { errorName: 'UnauthorizedError' },
    });

    await expect(
      syncCandidPatientRefunds({
        encounterId: ENCOUNTER_ID,
        refunds: [makeRefund()],
        oystehr: makeMockOystehr(),
        candidApiClient,
      })
    ).rejects.toThrow('Error deleting duplicate Candid patient refund');
  });
});
