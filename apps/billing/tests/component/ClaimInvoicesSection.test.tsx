import { render, screen, within } from '@testing-library/react';
import { ClaimDetailResponse } from 'utils/lib/types/data/billing/billing.types';
import { AR_STAGE } from 'utils/lib/types/data/billing/claim-status';
import { describe, expect, it, vi } from 'vitest';
import { ClaimInvoicesSection } from '../../src/components/ClaimInvoicesSection';

vi.mock('../../src/hooks/useInvoicingInBillingApp', () => ({ useInvoicingInBillingApp: () => true }));

describe('ClaimInvoicesSection', () => {
  it("lists the claim's invoices and lets an invoiced claim send another", () => {
    const claim = {
      id: 'claim-1',
      balance: 3.5,
      statuses: { arStage: AR_STAGE.patient, patientArStatus: 'invoiced' },
      invoices: [
        {
          id: 'inv-1',
          status: 'cancelled',
          issueDate: '2026-10-29T12:00:00.000Z',
          dueDate: '2026-11-05',
          amount: 3.5,
          hostedInvoiceUrl: 'https://pay.test/in_1',
        },
      ],
    } as ClaimDetailResponse;

    render(<ClaimInvoicesSection claim={claim} refetchClaim={vi.fn()} />);

    const row = within(screen.getByText('Void').closest('tr')!);
    expect(row.getAllByRole('cell').map((cell) => cell.textContent)).toEqual([
      '10/29/2026',
      '11/05/2026',
      'Void',
      'View',
      '$3.50',
    ]);
    expect(row.getByRole('link', { name: 'View' })).toHaveAttribute('href', 'https://pay.test/in_1');
    expect(screen.getByRole('button', { name: 'Send Invoice' })).toBeEnabled();
  });
});
