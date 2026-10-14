import Oystehr from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { PaymentNotice } from 'fhir/r4b';
import { PAYMENT_METHOD_EXTENSION_URL } from 'utils/lib/fhir/constants';
import { buildPaymentRefundsExtension } from 'utils/lib/fhir/paymentRefunds';
import { getOrCreateCandidApiClient } from 'utils/lib/helpers/candidApi';
import { PaymentRefundDTO } from 'utils/lib/types/api/patient-payment-types';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// ── Mocks (hoisted before imports) ─────────────────────────────────────────────

vi.mock('../../src/shared/sentry', () => ({ wrapHandler: (_name: string, handler: unknown) => handler }));
vi.mock('../../src/shared/auth', () => ({ checkOrCreateM2MClientToken: vi.fn().mockResolvedValue('token') }));
vi.mock('../../src/shared/helpers', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  createClinicalOystehrClient: vi.fn(),
}));
vi.mock('../../src/billing/shared', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  createBillingClient: vi.fn(),
}));
vi.mock('../../src/billing/payments', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  recordBillingManualRefund: vi.fn(),
}));
vi.mock('../../src/shared/stripeIntegration', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  applyRefundsToPaymentNotice: vi.fn(),
}));
vi.mock('utils/lib/helpers/candidApi', () => ({ getOrCreateCandidApiClient: vi.fn() }));
// transitive imports of shared/candid that pull heavy modules
vi.mock('../../src/ehr/shared/harvest', () => ({ getAccountAndCoverageResourcesForPatient: vi.fn() }));
vi.mock('../../src/shared/chart-data', () => ({ chartDataResourceHasMetaTagByCode: vi.fn() }));

// ── Imports ────────────────────────────────────────────────────────────────────

import { recordBillingManualRefund } from '../../src/billing/payments';
import { index } from '../../src/billing/record-billing-refund';
import { createBillingClient } from '../../src/billing/shared';
import { CANDID_PRE_ENCOUNTER_APPOINTMENT_ID_IDENTIFIER_SYSTEM } from '../../src/shared/candid';
import { createClinicalOystehrClient } from '../../src/shared/helpers';
import { applyRefundsToPaymentNotice } from '../../src/shared/stripeIntegration';
import { ZambdaInput } from '../../src/shared/types/common';

// ── Fixtures ───────────────────────────────────────────────────────────────────

const NOTICE_ID = '2e9e1a9e-5a1f-4b6e-9a51-9f6a3f1c2d3e';
const ENCOUNTER_ID = 'encounter-1';
const PATIENT_ID = 'patient-1';
const CANDID_APPOINTMENT_ID = 'candid-appt-1';

const stripeRefund: PaymentRefundDTO = {
  stripeRefundId: 're_123',
  amountInCents: 500,
  dateISO: '2026-04-22T12:00:00Z',
  status: 'succeeded',
};
const manualRefund: PaymentRefundDTO = {
  stripeRefundId: `manual_${NOTICE_ID}_key-1`,
  amountInCents: 1000,
  dateISO: '2026-04-22T13:00:00Z',
  status: 'succeeded',
  reason: 'Overcharge',
};
const externalRefund: PaymentRefundDTO = {
  stripeRefundId: `manual_${NOTICE_ID}_key-2`,
  amountInCents: 750,
  dateISO: '2026-04-22T14:00:00Z',
  status: 'succeeded',
  reason: 'Other',
  medium: 'check',
};
const pendingReservation: PaymentRefundDTO = {
  stripeRefundId: `manual_pending_${NOTICE_ID}_key-3`,
  amountInCents: 250,
  dateISO: new Date().toISOString(),
  status: 'pending',
};

function makeClinicalNotice(refunds: PaymentRefundDTO[]): PaymentNotice {
  return {
    resourceType: 'PaymentNotice',
    id: NOTICE_ID,
    status: 'active',
    request: { reference: `Encounter/${ENCOUNTER_ID}` },
    extension: [{ url: PAYMENT_METHOD_EXTENSION_URL, valueString: 'cash' }, buildPaymentRefundsExtension(refunds)],
  } as PaymentNotice;
}

const clinicalGet = vi.fn();
const clinicalSearch = vi.fn();
const billingSearch = vi.fn();
const candidGetMulti = vi.fn();
const candidCreate = vi.fn();

const invoke = (billingIntegration: string): Promise<APIGatewayProxyResult> =>
  (index as (input: ZambdaInput) => Promise<APIGatewayProxyResult>)({
    body: JSON.stringify({ clinicalPaymentNoticeId: NOTICE_ID }),
    headers: {},
    secrets: { BILLING_INTEGRATION: billingIntegration },
  } as unknown as ZambdaInput);

beforeEach(() => {
  vi.clearAllMocks();
  clinicalGet.mockResolvedValue(makeClinicalNotice([stripeRefund, manualRefund, externalRefund, pendingReservation]));
  clinicalSearch.mockReturnValue({
    unbundle: () => [
      { resourceType: 'Patient', id: PATIENT_ID },
      {
        resourceType: 'Appointment',
        id: 'appt-1',
        identifier: [{ system: CANDID_PRE_ENCOUNTER_APPOINTMENT_ID_IDENTIFIER_SYSTEM, value: CANDID_APPOINTMENT_ID }],
      },
      { resourceType: 'Encounter', id: ENCOUNTER_ID },
    ],
  });
  billingSearch.mockResolvedValue({ unbundle: () => [] });
  candidGetMulti.mockResolvedValue({ ok: true, body: { items: [] } });
  candidCreate.mockResolvedValue({ ok: true, body: { patientRefundId: 'candid-refund-1' } });

  vi.mocked(createClinicalOystehrClient).mockReturnValue({
    fhir: { get: clinicalGet, search: clinicalSearch },
  } as unknown as Oystehr);
  vi.mocked(createBillingClient).mockReturnValue({ fhir: { search: billingSearch } } as unknown as Oystehr);
  vi.mocked(getOrCreateCandidApiClient).mockResolvedValue({
    patientRefunds: { v1: { getMulti: candidGetMulti, create: candidCreate } },
  } as any);
});

// ── Tests ──────────────────────────────────────────────────────────────────────

describe('record-billing-refund candid sync', () => {
  it('pushes only FHIR-only refunds to Candid: stripe refunds and pending reservations are excluded', async () => {
    const result = await invoke('candid');

    expect(candidCreate).toHaveBeenCalledTimes(2);
    const createdAmounts = candidCreate.mock.calls.map(([arg]) => arg.amountCents);
    expect(createdAmounts).toEqual([manualRefund.amountInCents, externalRefund.amountInCents]);
    const createdNotes = candidCreate.mock.calls.map(([arg]) => arg.refundNote).join('\n');
    expect(createdNotes).not.toContain('re_123');
    expect(createdNotes).not.toContain('manual_pending_');

    // candid-only env records no Ottehr billing AR offsets
    expect(recordBillingManualRefund).not.toHaveBeenCalled();
    expect(JSON.parse(result.body)).toEqual({ billingNoticesStamped: 0, candidRefundsRecorded: 2 });
  });

  it('skips Candid entirely when BILLING_INTEGRATION is ottehr', async () => {
    const result = await invoke('ottehr');

    expect(getOrCreateCandidApiClient).not.toHaveBeenCalled();
    expect(candidCreate).not.toHaveBeenCalled();
    expect(recordBillingManualRefund).toHaveBeenCalledTimes(2);
    expect(JSON.parse(result.body)).toEqual({ billingNoticesStamped: 0, candidRefundsRecorded: 0 });
  });

  it('records both AR offsets and Candid refunds when BILLING_INTEGRATION is all', async () => {
    const result = await invoke('all');

    expect(recordBillingManualRefund).toHaveBeenCalledTimes(2);
    expect(candidCreate).toHaveBeenCalledTimes(2);
    expect(JSON.parse(result.body)).toEqual({ billingNoticesStamped: 0, candidRefundsRecorded: 2 });
  });

  it('does not create a Candid client when the notice has no FHIR-only refunds', async () => {
    clinicalGet.mockResolvedValue(makeClinicalNotice([stripeRefund]));

    const result = await invoke('candid');

    expect(getOrCreateCandidApiClient).not.toHaveBeenCalled();
    expect(JSON.parse(result.body)).toEqual({ billingNoticesStamped: 0, candidRefundsRecorded: 0 });
  });

  it('still stamps billing copies alongside the Candid sync', async () => {
    const billingCopy = { resourceType: 'PaymentNotice', id: 'pn-billing-1', status: 'active' } as PaymentNotice;
    billingSearch.mockResolvedValue({ unbundle: () => [billingCopy] });

    const result = await invoke('all');

    expect(applyRefundsToPaymentNotice).toHaveBeenCalledOnce();
    expect(vi.mocked(applyRefundsToPaymentNotice).mock.calls[0][1]).toBe(billingCopy);
    expect(JSON.parse(result.body)).toEqual({ billingNoticesStamped: 1, candidRefundsRecorded: 2 });
  });

  it('fails the request when the Candid create fails so the EHR retry can heal it', async () => {
    candidCreate.mockResolvedValue({ ok: false, error: { errorName: 'boom' } });

    await expect(invoke('candid')).rejects.toThrow('Error creating Candid patient refund');
  });
});
