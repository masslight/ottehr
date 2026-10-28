import Oystehr from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { PaymentNotice } from 'fhir/r4b';
import { BILLING_RESOURCE_TAG, PAYMENT_METHOD_EXTENSION_URL } from 'utils/lib/fhir/constants';
import { ottehrIdentifierSystem } from 'utils/lib/fhir/systemUrls';
import { DailyPaymentsReportZambdaOutput } from 'utils/lib/types/api/daily-payments-report.types';
import { beforeEach, describe, expect, it, vi } from 'vitest';

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

import { createBillingClient } from '../../src/billing/shared';
import { index } from '../../src/ehr/daily-payments-report';
import { createClinicalOystehrClient } from '../../src/shared/helpers';
import { STRIPE_PAYMENT_ID_SYSTEM } from '../../src/shared/stripeIntegration';
import { ZambdaInput } from '../../src/shared/types/common';

type SearchArgs = { params: { name: string; value: string }[] };

// One card payment recorded in both workspaces: Stripe's charge time (the billing copy) falls just
// before midnight, the EHR notice was written just after.
const billingCopy = {
  resourceType: 'PaymentNotice',
  id: 'billing-1',
  meta: { tag: [BILLING_RESOURCE_TAG] },
  status: 'active',
  created: '2026-10-26T23:59:59.000Z',
  amount: { value: 40, currency: 'USD' },
  request: { type: 'Claim', identifier: { system: ottehrIdentifierSystem('claim-encounter-id'), value: 'enc-1' } },
  identifier: [
    { system: STRIPE_PAYMENT_ID_SYSTEM, value: 'ch_1' },
    { system: STRIPE_PAYMENT_ID_SYSTEM, value: 'pi_1' },
  ],
  extension: [{ url: PAYMENT_METHOD_EXTENSION_URL, valueString: 'card' }],
} as PaymentNotice;

const legacyNotice = {
  resourceType: 'PaymentNotice',
  id: 'clinical-1',
  status: 'active',
  created: '2026-10-27T00:00:01.000Z',
  amount: { value: 40, currency: 'USD' },
  request: { reference: 'Encounter/enc-1' },
  identifier: [{ system: STRIPE_PAYMENT_ID_SYSTEM, value: 'pi_1' }],
  extension: [{ url: PAYMENT_METHOD_EXTENSION_URL, valueString: 'card' }],
} as PaymentNotice;

const createdWithin = (notice: PaymentNotice, params: SearchArgs['params']): boolean => {
  const ge = params.find((param) => param.name === 'created' && param.value.startsWith('ge'))?.value.slice(2);
  const le = params.find((param) => param.name === 'created' && param.value.startsWith('le'))?.value.slice(2);
  // compared at each bound's own precision, as FHIR does ('le2026-10-27' covers that whole day)
  const created = notice.created ?? '';
  return (!ge || created.slice(0, ge.length) >= ge) && (!le || created.slice(0, le.length) <= le);
};

// a window search filters by created; a counterpart search matches by identifier, whatever the date
const fakeWorkspace = (notices: PaymentNotice[]): Oystehr =>
  ({
    fhir: {
      search: vi.fn(async ({ params }: SearchArgs) => {
        const identifier = params.find((param) => param.name === 'identifier' && !param.value.endsWith('|'));
        const matches = notices.filter((notice) =>
          identifier
            ? notice.identifier?.some((id) => identifier.value.split(',').includes(`${id.system}|${id.value}`))
            : createdWithin(notice, params)
        );
        return { unbundle: () => matches };
      }),
    },
  }) as unknown as Oystehr;

const report = async (start: string, end: string): Promise<DailyPaymentsReportZambdaOutput> => {
  const result = await (index as (input: ZambdaInput) => Promise<APIGatewayProxyResult>)({
    body: JSON.stringify({ dateRange: { start, end } }),
    headers: {},
    secrets: {},
  } as unknown as ZambdaInput);
  return JSON.parse(result.body);
};

beforeEach(() => {
  vi.mocked(createBillingClient).mockReturnValue(fakeWorkspace([billingCopy]));
  vi.mocked(createClinicalOystehrClient).mockReturnValue(fakeWorkspace([legacyNotice]));
});

describe('daily-payments-report', () => {
  it('counts a payment whose two records straddle midnight on one day only', async () => {
    const dayOne = await report('2026-10-26T00:00:00.000Z', '2026-10-26T23:59:59.999Z');
    const dayTwo = await report('2026-10-27T00:00:00.000Z', '2026-10-27T23:59:59.999Z');
    const bothDays = await report('2026-10-26T00:00:00.000Z', '2026-10-27T23:59:59.999Z');

    expect(dayOne).toMatchObject({ totalAmount: 40, totalTransactions: 1 });
    expect(dayOne.paymentMethods[0].payments[0].id).toBe('billing-1');
    expect(dayTwo).toMatchObject({ totalAmount: 0, totalTransactions: 0 });
    expect(bothDays).toMatchObject({ totalAmount: 40, totalTransactions: 1 });
  });

  it('reads a date-only range as whole days', async () => {
    const dayTwo = await report('2026-10-27', '2026-10-27');
    const dayOne = await report('2026-10-26', '2026-10-26');

    expect(dayTwo).toMatchObject({ totalAmount: 0, totalTransactions: 0 });
    expect(dayOne).toMatchObject({ totalAmount: 40, totalTransactions: 1 });
  });
});
