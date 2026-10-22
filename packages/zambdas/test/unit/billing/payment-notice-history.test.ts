import Oystehr from '@oystehr/sdk';
import { PaymentNotice } from 'fhir/r4b';
import { PENDING_RESERVATION_PREFIX } from 'utils/lib/fhir/paymentRefunds';
import { describe, expect, it, vi } from 'vitest';
import { recordPaymentNoticeChange } from '../../../src/billing/payments';
import { applyRefundsToPaymentNotice, voidPaymentNotice } from '../../../src/shared/stripeIntegration';
import { claimHistoryEntries, provenanceChanges, TEST_AGENT } from './claim-history-fixtures';

const billingCopy: PaymentNotice = {
  resourceType: 'PaymentNotice',
  id: 'pn-billing',
  status: 'active',
  created: '2026-10-01T12:00:00Z',
  amount: {
    value: 50,
    currency: 'USD',
  },
  payment: {
    reference: '#contained-reconciliation',
  },
  recipient: {
    reference: 'Organization/o1',
  },
  request: {
    reference: 'Claim/claim-1',
  },
};

const makeOystehr = (): {
  oystehr: Oystehr;
  transaction: ReturnType<typeof vi.fn>;
  patch: ReturnType<typeof vi.fn>;
} => {
  const transaction = vi.fn().mockResolvedValue({
    entry: [],
  });
  const patch = vi.fn().mockResolvedValue({});
  return {
    oystehr: {
      fhir: {
        transaction,
        patch,
      },
    } as unknown as Oystehr,
    transaction,
    patch,
  };
};

describe('payment notice changes with a claim history recorder', () => {
  it('writes a void and its claim history entry together', async () => {
    const { oystehr, transaction, patch } = makeOystehr();

    await voidPaymentNotice(
      oystehr,
      billingCopy,
      {
        reason: 'Entered in error',
        voidedAtISO: '2026-10-02T12:00:00Z',
      },
      recordPaymentNoticeChange(TEST_AGENT)
    );

    expect(patch).not.toHaveBeenCalled();
    const { requests } = transaction.mock.calls[0][0];
    expect(requests[0]).toMatchObject({
      method: 'PATCH',
      url: '/PaymentNotice/pn-billing',
    });
    const [entry] = claimHistoryEntries(requests);
    expect(entry.target).toEqual([
      {
        reference: 'PaymentNotice/pn-billing',
      },
      {
        reference: 'Claim/claim-1',
      },
    ]);
    expect(provenanceChanges(entry)).toEqual([
      {
        field: 'status',
        label: 'Status',
        previousValue: 'active',
        newValue: 'cancelled',
      },
      {
        field: 'voidReason',
        label: 'Void Reason',
        previousValue: null,
        newValue: 'Entered in error',
      },
    ]);
  });

  it('patches a clinical notice on its own, as before', async () => {
    const { oystehr, transaction, patch } = makeOystehr();

    await voidPaymentNotice(oystehr, billingCopy, {
      reason: 'Entered in error',
      voidedAtISO: '2026-10-02T12:00:00Z',
    });

    expect(transaction).not.toHaveBeenCalled();
    expect(patch).toHaveBeenCalledTimes(1);
  });

  it('writes no history entry for a refund reservation, which moves no money', async () => {
    const { oystehr, transaction, patch } = makeOystehr();

    await applyRefundsToPaymentNotice(
      oystehr,
      billingCopy,
      [
        {
          stripeRefundId: `${PENDING_RESERVATION_PREFIX}op-1`,
          amountInCents: 2000,
          dateISO: new Date().toISOString(),
          status: 'pending',
        },
      ],
      undefined,
      recordPaymentNoticeChange(TEST_AGENT)
    );

    expect(transaction).not.toHaveBeenCalled();
    expect(patch).toHaveBeenCalledTimes(1);
  });
});

describe('payment notice change attribution', () => {
  const SYSTEM_AGENT = {
    who: {
      reference: 'Device/system',
    },
  };

  const recordedAgent = (transaction: ReturnType<typeof vi.fn>): unknown =>
    claimHistoryEntries(transaction.mock.calls[0][0].requests)[0].agent;

  it('attributes a void to the user the EHR stamped on it', async () => {
    const { oystehr, transaction } = makeOystehr();

    await voidPaymentNotice(
      oystehr,
      billingCopy,
      {
        reason: 'Entered in error',
        voidedAtISO: '2026-10-02T12:00:00Z',
        voidedBy: 'Jane Doe',
        voidedByReference: 'Practitioner/jane',
      },
      recordPaymentNoticeChange(SYSTEM_AGENT)
    );

    expect(recordedAgent(transaction)).toMatchObject([
      {
        who: {
          reference: 'Practitioner/jane',
        },
      },
    ]);
  });

  it('attributes an added refund to the user who issued it', async () => {
    const { oystehr, transaction } = makeOystehr();

    await applyRefundsToPaymentNotice(
      oystehr,
      billingCopy,
      [
        {
          stripeRefundId: 're_1',
          amountInCents: 2000,
          dateISO: '2026-10-02T12:00:00Z',
          status: 'succeeded',
          refundedByReference: 'Practitioner/jane',
        },
      ],
      undefined,
      recordPaymentNoticeChange(SYSTEM_AGENT)
    );

    expect(recordedAgent(transaction)).toMatchObject([
      {
        who: {
          reference: 'Practitioner/jane',
        },
      },
    ]);
  });

  it('attributes a refund nobody stamped, like one made in the Stripe dashboard, to the system', async () => {
    const { oystehr, transaction } = makeOystehr();

    await applyRefundsToPaymentNotice(
      oystehr,
      billingCopy,
      [
        {
          stripeRefundId: 're_1',
          amountInCents: 2000,
          dateISO: '2026-10-02T12:00:00Z',
          status: 'succeeded',
        },
      ],
      undefined,
      recordPaymentNoticeChange(SYSTEM_AGENT)
    );

    expect(recordedAgent(transaction)).toEqual([SYSTEM_AGENT]);
  });
});
