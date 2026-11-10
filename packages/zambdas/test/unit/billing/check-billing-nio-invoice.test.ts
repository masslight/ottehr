import Oystehr from '@oystehr/sdk';
import {
  BILLING_INVOICE_CONFLICT_ERROR,
  FHIR_RESOURCE_NOT_FOUND_CUSTOM,
  INVALID_INPUT_ERROR,
  RESOURCE_INCOMPLETE_FOR_OPERATION_ERROR,
} from 'utils/lib/types/errors';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { performEffect } from '../../../src/billing/check-billing-nio-invoice';

const { mockAssembleNioInvoice } = vi.hoisted(() => ({
  mockAssembleNioInvoice: vi.fn(),
}));

vi.mock('../../../src/shared/sentry', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  wrapHandler: (_name: string, fn: (...args: unknown[]) => unknown) => fn,
}));
vi.mock('../../../src/billing/nio-invoice', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  assembleNioInvoice: (...args: unknown[]) => mockAssembleNioInvoice(...args),
}));

const oystehr = {} as Oystehr;
const claimIds = ['claim-1', 'claim-2'];

describe('check-billing-nio-invoice', () => {
  beforeEach(() => {
    mockAssembleNioInvoice.mockReset();
  });

  it('reports claims that can go on one invoice', async () => {
    mockAssembleNioInvoice.mockResolvedValue({});

    expect(
      await performEffect({
        oystehr,
        claimIds,
      })
    ).toEqual({
      invoiceable: true,
    });
    expect(mockAssembleNioInvoice).toHaveBeenCalledWith({
      oystehr,
      claimIds,
      nameClaims: true,
    });
  });

  it.each([
    INVALID_INPUT_ERROR('All claims must have the same service facility'),
    BILLING_INVOICE_CONFLICT_ERROR('Pruitt, Jordan (2026-09-14) is already on an invoice'),
    FHIR_RESOURCE_NOT_FOUND_CUSTOM('Claims not found: claim-2'),
    RESOURCE_INCOMPLETE_FOR_OPERATION_ERROR('Non-insurance payer nio-1 has no name'),
  ])('returns the broken rule "$message" as the reason', async (error) => {
    mockAssembleNioInvoice.mockRejectedValue(error);

    expect(
      await performEffect({
        oystehr,
        claimIds,
      })
    ).toEqual({
      invoiceable: false,
      reason: error.message,
    });
  });

  it('throws errors that are not invoice rules', async () => {
    const outage = new Error('FHIR unavailable');
    mockAssembleNioInvoice.mockRejectedValue(outage);

    await expect(
      performEffect({
        oystehr,
        claimIds,
      })
    ).rejects.toBe(outage);
  });
});
