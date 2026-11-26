import Oystehr from '@oystehr/sdk';
import { STATEMENT_BILLING_CLAIM_NOT_FOUND_ERROR } from 'utils/lib/types/errors';
import { describe, expect, it, vi } from 'vitest';
import {
  fetchClaimResponsesByClaimIds,
  fetchNioPaidByClaimId,
  fetchPatientPaymentsByEncounterIds,
} from '../../../src/billing/claim-amounts';
import { findBillingClaimForEncounter } from '../../../src/billing/payments';
import { fetchWriteOffsByClaimIds } from '../../../src/billing/write-offs';
import { getBillingStatementLines } from '../../../src/shared/statements/get-billing-statement-lines';

vi.mock('../../../src/billing/payments', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../src/billing/payments')>()),
  findBillingClaimForEncounter: vi.fn(),
}));
vi.mock('../../../src/billing/claim-amounts', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../src/billing/claim-amounts')>()),
  fetchPatientPaymentsByEncounterIds: vi.fn(),
  fetchClaimResponsesByClaimIds: vi.fn(),
  fetchNioPaidByClaimId: vi.fn(),
}));
vi.mock('../../../src/billing/write-offs', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../src/billing/write-offs')>()),
  fetchWriteOffsByClaimIds: vi.fn(),
}));

const oystehr = {} as Oystehr;
const input = { encounterId: 'enc-1', billingOystehr: oystehr, eraReadOystehr: oystehr, clinicalOystehr: oystehr };

describe('getBillingStatementLines errors', () => {
  it('reports the missing claim even when the payment lookup fails too', async () => {
    let rejectPayments: (error: Error) => void = () => undefined;
    vi.mocked(fetchPatientPaymentsByEncounterIds).mockReturnValue(
      new Promise((_, reject) => {
        rejectPayments = reject;
      })
    );
    vi.mocked(findBillingClaimForEncounter).mockImplementation(async () => {
      rejectPayments(new Error('payments unavailable'));
      await new Promise((resolve) => setTimeout(resolve, 0));
      return undefined;
    });

    await expect(getBillingStatementLines(input)).rejects.toEqual(STATEMENT_BILLING_CLAIM_NOT_FOUND_ERROR('enc-1'));
  });

  it('reports the payment lookup failure when the claim exists', async () => {
    vi.mocked(findBillingClaimForEncounter).mockResolvedValue({
      resourceType: 'Claim',
      id: 'claim-1',
    } as Awaited<ReturnType<typeof findBillingClaimForEncounter>>);
    vi.mocked(fetchClaimResponsesByClaimIds).mockResolvedValue(new Map());
    vi.mocked(fetchWriteOffsByClaimIds).mockResolvedValue(new Map());
    vi.mocked(fetchNioPaidByClaimId).mockResolvedValue(new Map());
    vi.mocked(fetchPatientPaymentsByEncounterIds).mockRejectedValue(new Error('payments unavailable'));

    await expect(getBillingStatementLines(input)).rejects.toThrow('payments unavailable');
  });
});
