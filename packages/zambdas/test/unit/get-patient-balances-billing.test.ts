import Oystehr from '@oystehr/sdk';
import { PatientArClaimItem } from 'utils';
import { describe, expect, it, vi } from 'vitest';
import { performBillingEffect } from '../../src/ehr/get-patient-balances';
import { ValidatedInput } from '../../src/ehr/get-patient-balances/validateRequestParameters';

const validatedInput: ValidatedInput = {
  body: { patientId: 'pat-1' },
  callerAccessToken: 'test-token',
};

const encounter = (id: string, appointmentId?: string): unknown => ({
  resourceType: 'Encounter',
  id,
  ...(appointmentId ? { appointment: [{ reference: `Appointment/${appointmentId}` }] } : {}),
});

const appointment = (id: string, start?: string): unknown => ({
  resourceType: 'Appointment',
  id,
  ...(start ? { start } : {}),
});

const mockOystehr = (clinicalResources: unknown[], claims: PatientArClaimItem[]): Oystehr =>
  ({
    fhir: {
      search: vi.fn().mockResolvedValueOnce({ link: [], unbundle: () => clinicalResources }),
    },
    zambda: {
      execute: vi.fn().mockResolvedValueOnce({ output: { claims, balance: {} } }),
    },
  }) as unknown as Oystehr;

const claim = (overrides: Partial<PatientArClaimItem>): PatientArClaimItem => ({
  claimId: 'claim-1',
  patientId: 'pat-1',
  patientName: 'Test, Katie',
  patientDob: '1990-01-15',
  encounterId: 'enc-1',
  appointmentId: 'appt-1',
  serviceDate: '2026-07-01',
  finalizationDate: '2026-06-05T10:00:00Z',
  billed: 250,
  allowed: 200,
  insurancePaid: 150,
  patientResp: 50,
  patientPaid: 0,
  balance: 50,
  adjudicated: true,
  ...overrides,
});

describe('get-patient-balances - performBillingEffect', () => {
  it('resolves the patient encounters, fetches billing balances for them, and maps to the clinical contract in cents', async () => {
    const oystehr = mockOystehr(
      [
        encounter('enc-1', 'appt-1'),
        appointment('appt-1', '2026-07-01T10:00:00Z'),
        encounter('enc-2', 'appt-2'),
        appointment('appt-2', '2026-06-15T09:00:00Z'),
      ],
      [
        claim({ claimId: 'claim-1', encounterId: 'enc-1', balance: 75.5 }),
        claim({ claimId: 'claim-2', encounterId: 'enc-2', balance: 20 }),
      ]
    );

    const result = await performBillingEffect(validatedInput, oystehr);

    expect(oystehr.zambda.execute).toHaveBeenCalledWith({
      id: 'get-billing-patient-balance',
      encounterIds: ['enc-1', 'enc-2'],
    });
    expect(result).toEqual({
      encounters: [
        {
          encounterId: 'enc-1',
          encounterDate: '2026-07-01T10:00:00Z',
          appointmentId: 'appt-1',
          patientBalanceCents: 7550,
        },
        {
          encounterId: 'enc-2',
          encounterDate: '2026-06-15T09:00:00Z',
          appointmentId: 'appt-2',
          patientBalanceCents: 2000,
        },
      ],
      totalBalanceCents: 9550,
      pendingPaymentCents: 0,
      patientCreditCents: 0,
    });
  });

  it('returns the empty contract without calling the billing zambda when the patient has no eligible encounters', async () => {
    const oystehr = mockOystehr([encounter('enc-1'), encounter('enc-2', 'appt-2'), appointment('appt-2')], []);

    const result = await performBillingEffect(validatedInput, oystehr);

    expect(oystehr.zambda.execute).not.toHaveBeenCalled();
    expect(result).toEqual({ encounters: [], totalBalanceCents: 0, pendingPaymentCents: 0, patientCreditCents: 0 });
  });

  it('keeps the first claim per encounter, matching the invoicing pipeline', async () => {
    const oystehr = mockOystehr(
      [encounter('enc-1', 'appt-1'), appointment('appt-1', '2026-07-01T10:00:00Z')],
      [claim({ claimId: 'claim-1', balance: 30 }), claim({ claimId: 'claim-2', balance: 12.25 })]
    );

    const result = await performBillingEffect(validatedInput, oystehr);

    expect(result.encounters).toEqual([
      {
        encounterId: 'enc-1',
        encounterDate: '2026-07-01T10:00:00Z',
        appointmentId: 'appt-1',
        patientBalanceCents: 3000,
      },
    ]);
    expect(result.totalBalanceCents).toBe(3000);
  });

  it('skips claims that do not map back to a requested encounter', async () => {
    const oystehr = mockOystehr(
      [encounter('enc-1', 'appt-1'), appointment('appt-1', '2026-07-01T10:00:00Z')],
      [claim({ claimId: 'claim-1', balance: 50 }), claim({ claimId: 'claim-2', encounterId: null })]
    );

    const result = await performBillingEffect(validatedInput, oystehr);

    expect(result.encounters).toHaveLength(1);
    expect(result.totalBalanceCents).toBe(5000);
  });

  it('returns an overpayment as patient credit while leaving posted payments out of pending payments', async () => {
    const oystehr = mockOystehr(
      [encounter('enc-1', 'appt-1'), appointment('appt-1', '2026-07-01T10:00:00Z')],
      [claim({ claimId: 'claim-1', balance: -12.5, patientPaid: 62.5 })]
    );

    const result = await performBillingEffect(validatedInput, oystehr);

    expect(result.encounters).toEqual([]);
    expect(result.totalBalanceCents).toBe(0);
    expect(result.pendingPaymentCents).toBe(0);
    expect(result.patientCreditCents).toBe(1250);
  });

  it('keeps settled and overpaid claims out of the payable encounters and nets them against balances due for credit', async () => {
    const oystehr = mockOystehr(
      [
        encounter('enc-1', 'appt-1'),
        appointment('appt-1', '2026-07-01T10:00:00Z'),
        encounter('enc-2', 'appt-2'),
        appointment('appt-2', '2026-06-15T09:00:00Z'),
        encounter('enc-3', 'appt-3'),
        appointment('appt-3', '2026-05-20T09:00:00Z'),
      ],
      [
        claim({ claimId: 'claim-1', encounterId: 'enc-1', balance: 50 }),
        claim({ claimId: 'claim-2', encounterId: 'enc-2', balance: -12.5, patientPaid: 62.5 }),
        claim({ claimId: 'claim-3', encounterId: 'enc-3', balance: 0, patientPaid: 50 }),
      ]
    );

    const result = await performBillingEffect(validatedInput, oystehr);

    expect(result.encounters).toEqual([
      {
        encounterId: 'enc-1',
        encounterDate: '2026-07-01T10:00:00Z',
        appointmentId: 'appt-1',
        patientBalanceCents: 5000,
      },
    ]);
    expect(result.totalBalanceCents).toBe(5000);
    // the $12.50 overpayment is absorbed by the $50 still owed, matching the Candid patient-level balance
    expect(result.patientCreditCents).toBe(0);
  });

  it('reports credit for the portion of overpayments exceeding the balances still due', async () => {
    const oystehr = mockOystehr(
      [
        encounter('enc-1', 'appt-1'),
        appointment('appt-1', '2026-07-01T10:00:00Z'),
        encounter('enc-2', 'appt-2'),
        appointment('appt-2', '2026-06-15T09:00:00Z'),
      ],
      [
        claim({ claimId: 'claim-1', encounterId: 'enc-1', balance: 10 }),
        claim({ claimId: 'claim-2', encounterId: 'enc-2', balance: -30, patientPaid: 80 }),
      ]
    );

    const result = await performBillingEffect(validatedInput, oystehr);

    expect(result.encounters).toHaveLength(1);
    expect(result.totalBalanceCents).toBe(1000);
    expect(result.patientCreditCents).toBe(2000);
  });

  it('ignores duplicate encounter claims entirely, even when they would contribute credit', async () => {
    const oystehr = mockOystehr(
      [encounter('enc-1', 'appt-1'), appointment('appt-1', '2026-07-01T10:00:00Z')],
      [claim({ claimId: 'claim-1', balance: 30 }), claim({ claimId: 'claim-2', balance: -12.25, patientPaid: 42.25 })]
    );

    const result = await performBillingEffect(validatedInput, oystehr);

    expect(result.encounters).toHaveLength(1);
    expect(result.totalBalanceCents).toBe(3000);
    expect(result.patientCreditCents).toBe(0);
  });
});
